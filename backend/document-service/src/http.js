export async function authenticatedJson(url, token) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Dependência respondeu ${response.status}: ${body}`);
    error.status = response.status === 404 ? 404 : 502;
    throw error;
  }
  return response.json();
}

