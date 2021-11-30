const fetch = require('node-fetch');

/* eslint-disable no-await-in-loop, no-restricted-syntax */
async function* fetchPage (path, apiKey) {
  let url = path;

  while (url) {
    const response = await fetch(url, { headers: { Authorization: `Token ${apiKey}` } });
    const parsedResponse = await response.json();

    url = parsedResponse?.next;
    yield parsedResponse.results;
  }
}

exports.getPaginatedResults = async (path, apiKey) => {
  const rows = [];
  const iterator = fetchPage(path, apiKey);

  for await (const response of iterator) {
    rows.push(...response);
  }

  return rows;
};

exports.getJSON = async (path, apiKey) => {
  try {
    const response = await fetch(path, { headers: { Authorization: `Token ${apiKey}` } });
    return response.json();
  } catch (e) {
    console.error(e); // eslint-disable-line no-console
    return undefined;
  }
};

const cache = [
  '',
  ' ',
  '  ',
  '   ',
  '    ',
  '     ',
  '      ',
  '       ',
  '        ',
  '         ',
];

/* eslint-disable */
exports.leftPad = (str, len, ch) => {
  // convert `str` to a `string`
  str = str + '';
  // `len` is the `pad`'s length now
  len = len - str.length;
  // doesn't need to pad
  if (len <= 0) return str;
  // `ch` defaults to `' '`
  if (!ch && ch !== 0) ch = ' ';
  // convert `ch` to a `string` cuz it could be a number
  ch = ch + '';
  // cache common use cases
  if (ch === ' ' && len < 10) return cache[len] + str;
  // `pad` starts with an empty string
  var pad = '';
  // loop
  while (true) {
    // add `ch` to `pad` if `len` is odd
    if (len & 1) pad += ch;
    // divide `len` by 2, ditch the remainder
    len >>= 1;
    // "double" the `ch` so this operation count grows logarithmically on `len`
    // each time `ch` is "doubled", the `len` would need to be "doubled" too
    // similar to finding a value in binary search tree, hence O(log(n))
    if (len) ch += ch;
    // `len` is 0, exit the loop
    else break;
  }
  // pad `str`!
  return pad + str;
};
/* eslint-enable */
