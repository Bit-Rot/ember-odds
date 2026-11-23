const paths = {
  blade:'M4 20l9-9m-6 3 3 3m2-4 2 2 6-10 1-3-3 1-10 6 2 2M3 21l3-3',
  shield:'M12 3 4.5 6v5.5c0 4.2 3 7 7.5 9.5 4.5-2.5 7.5-5.3 7.5-9.5V6L12 3Zm0 4v10',
  hammer:'m4 21 9-10m-6 7-2-2m3-9 5-5 3 3 3 1 3 3-5 5-4-4-3-1Z',
  split:'M6 21v-6c0-2 2-3 6-4l7-3m0 0-5-2m5 2-2 5M6 3v3c0 2 2 3 4 4m5 5 4 3m0 0-5 2m5-2-1-5',
  spark:'m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z',
  die:'M6 4h12l2 2v12l-2 2H6l-2-2V6l2-2Zm2 4h.01m4 4h.01m4 4h.01m0-8h.01m-8 8h.01',
  fist:'m6 14-2-4 2-2 2 2V5l2-1 2 1V4l2-1 2 2v1l2-1 2 2v7l-4 6H9l-3-6Zm3-4 3 3h3',
  wind:'M3 8h12c4 0 4-5 1-5-1 0-2 .6-2 2M2 12h17c4 0 4 5 1 5m-15-1h6c4 0 4 5 1 5',
  flame:'M13 2c0 5-5 6-5 10-2-1-2-2-2-3-2 3-3 5-2 8 1 3 4 5 8 5 5 0 8-3 8-7 0-3-2-5-3-6 0 2-1 3-2 3 0-4 0-7-2-10Z',
  heart:'M12 21 4 13c-5-5 2-11 6-7l2 2 2-2c4-4 11 2 6 7l-8 8Z',
  question:'M8 8a4 4 0 1 1 6 3.5c-1.5.9-2 1.5-2 3.5m0 4h.01',
  relic:'m12 2 8 6v8l-8 6-8-6V8l8-6Zm0 5 4 5-4 5-4-5 4-5Z',
  crown:'m2 7 5 5 5-8 5 8 5-5-3 11H5L2 7Zm3 14h14',
  deck:'M8 3h11v15H8Zm-3 4v14h11M11 8h5m-5 4h4',
  discard:'M5 6h14l-1 14H6L5 6Zm-2 0h18M9 6V3h6v3m-5 4v6m4-6v6',
  reroll:'M20 8a8 8 0 0 0-14-2L3 9m0 0V4m0 5h5m-4 7a8 8 0 0 0 14 2l3-3m0 0v5m0-5h-5',
  close:'m6 6 12 12M18 6 6 18',
  check:'m5 12 5 5L20 7',
  door:'M5 21h14V3H5Zm8-9h.01',
  sap:'M12 3v13m-4-4 4 4 4-4M6 21h12',
};

export function icon(key, extra = '') {
  return '<svg class="glyph ' + extra + '" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + paths[key] + '"/></svg>';
}
