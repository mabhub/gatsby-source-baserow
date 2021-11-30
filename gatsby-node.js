const { createRemoteFileNode } = require('gatsby-source-filesystem');

const slugify = require('slugify');
const camelCase = require('camelcase');

const { getPaginatedResults, leftPad, getJSON } = require('./lib');

const cleanString = str => slugify(str, { lower: true, strict: true, locale: 'fr' });

const getStringValues = obj => {
  const str = Object.entries(obj).reduce((acc, [key, value]) => {
    if (!value) {
      return acc;
    }

    if (typeof value === 'string') {
      return `${acc}${value}`;
    }

    if (Array.isArray(value)) {
      return acc + value.map(item => item.value);
    }

    if (typeof value === 'object') {
      return value.value === 'Oui'
        ? `${acc}${key}`
        : `${acc}${value.value}`;
    }

    return acc;
  }, '');

  return cleanString(str)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
};

exports.sourceNodes = async (
  {
    actions: { createNode },
    store,
    cache,
    createNodeId,
    createContentDigest,
    reporter,
  },
  { // Plugin options
    tables = [],
    host = 'https://api.baserow.io',
    apiKey = '',
  },
) => {
  const validTablesIds = tables.map(({ tableId }) => tableId);

  const createRemoteFileNodeOptions = {
    store,
    cache,
    createNode,
    createNodeId,
    createContentDigest,
  };

  // eslint-disable-next-line no-restricted-syntax
  for await (const { tableId, tableName, excludes = [] } of tables) {
    const rows = await getPaginatedResults(`${host}/api/database/rows/table/${tableId}/`, apiKey);
    const tableSchema = await getJSON(`${host}/api/database/fields/table/${tableId}/`, apiKey);

    reporter.info(`Baserow: [${tableId}] "${tableName}": Start processing table`);

    await Promise.all(rows.map(async row => {
      const children = [];
      const nodeId = `baserow-table-${tableId}-row-${row.id}`;

      const columnsEntries = await Promise.all(tableSchema
        .filter(({ name }) => !excludes.includes(name))
        .map(async field => {
          // Slug of current field
          const slug = camelCase(cleanString(field.name));
          const values = row[`field_${field.id}`];

          // Resolve relation link between rows
          if (field.type === 'link_row' && validTablesIds.includes(`${field.link_row_table}`)) {
            values.forEach(value => {
              // eslint-disable-next-line no-param-reassign
              value.node___NODE = `baserow-table-${field.link_row_table}-row-${value.id}`;
              children.push(value.node___NODE);
            });
          }

          // Create remote file node for file fields
          if (field.type === 'file') {
            // url, thumbnails, visible_name, name, size, mime_type, is_image,
            // image_width, image_height, uploaded_at
            await Promise.all(values.map(async value => {
              const remoteFileNode = await createRemoteFileNode({
                ...createRemoteFileNodeOptions,
                url: value.url,
                parentNodeId: nodeId,
              });

              if (remoteFileNode) {
                // eslint-disable-next-line no-param-reassign
                value.node___NODE = remoteFileNode.id;
                children.push(value.node___NODE);
              }
            }));
          }

          return [slug, values];
        }));
      const columns = Object.fromEntries(columnsEntries);

      return createNode({
        order: row.order || 0,
        row,
        columns,

        // TODO: exclude "private" fields
        columnsRaw: JSON.stringify(columns),
        searchString: getStringValues(columns),

        id: nodeId,
        internal: { type: tableName, contentDigest: createContentDigest(row) },
        children,
      });
    }));

    reporter.info(`Baserow: [${tableId}] "${tableName}": ✅ ${leftPad(rows.length, 3)} rows with ${tableSchema.length} fields found.`);
  }
};
