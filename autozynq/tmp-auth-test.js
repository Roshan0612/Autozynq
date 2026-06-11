const { URLSearchParams } = require('url');
(async () => {
  const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3001';
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`, { redirect: 'manual' });
  const setCookie = csrfRes.headers.get('set-cookie');
  const cookies = setCookie ? [setCookie] : [];
  console.log('csrf status', csrfRes.status);
  const csrfJson = await csrfRes.json();
  console.log('csrf json', csrfJson);
  const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
  const params = new URLSearchParams();
  params.append('csrfToken', csrfJson.csrfToken);
  params.append('callbackUrl', `${baseUrl}/dashboard`);
  params.append('email', 'auth-test@example.com');
  params.append('password', 'test12345');
  params.append('json', 'true');
  const loginRes = await fetch(`${baseUrl}/api/auth/callback/credentials?json=true`, {
    method: 'POST',
    body: params,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      cookie: cookieHeader,
    },
    redirect: 'manual',
  });
  console.log('login status', loginRes.status);
  console.log('login headers', Object.fromEntries(loginRes.headers.entries()));
  const text = await loginRes.text();
  console.log('login body', text);
  console.log('cookies', cookies);
})();
