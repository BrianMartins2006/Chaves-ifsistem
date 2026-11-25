IfsistemSSO.handleCallback().then(user => {
  if (!user) throw new Error('Retorno de login sem código de autorização.');
  location.replace('/');
}).catch(error => { document.getElementById('status').textContent = error.message; });
