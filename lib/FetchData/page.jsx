export async function fetchData({ method = "GET", url, body = null }) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      console.log(`Error ${response.status}: ${response.statusText}`);
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error("Fetch error:", error);
    return { error: error.message };
  }
}
