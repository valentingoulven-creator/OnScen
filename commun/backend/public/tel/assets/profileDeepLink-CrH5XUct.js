function t(o){return`/profile/${encodeURIComponent(o)}`}function e(o=window.location){const n=o.pathname.match(/^\/profile\/([^/]+)\/?$/i);return n?decodeURIComponent(n[1]):null}export{e as n,t};
