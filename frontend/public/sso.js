const local = location.hostname === 'localhost';
IfsistemSSO.init({
  authUrl: local ? 'http://localhost:9000' : 'https://ifsistem-auth.onrender.com',
  clientId: 'chaves',
  redirectUri: location.origin + '/callback.html',
  postLogoutRedirectUri: location.origin + '/'
});
window.IfsistemSSO = IfsistemSSO;
