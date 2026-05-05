// נקודת ייצוא מרכזית של שירות אוריין
//
// במקום לייבא מקבצים נפרדים (auth.js, xml.js וכו'), הקוד יכול לכתוב:
//   import * as orian from './services/orian/index.js';
//   await orian.login();

export { login, logout, getToken, hasValidToken } from './auth.js';
export { parseXml, buildXml } from './xml.js';
export { default as client } from './client.js';
