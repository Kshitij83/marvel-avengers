window.API = window.API || {};

API.json = async function (url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + " -> " + res.status);
  return res.json();
};

API.config = function () {
  return API.json("/api/config");
};

API.characters = function () {
  return API.json("/api/characters").then(function (d) {
    return (d && d.characters) || [];
  });
};

API.movies = function () {
  return API.json("/api/movies").then(function (d) {
    return {
      phases: (d && d.phases) || [],
      movies: (d && d.movies) || []
    };
  });
};

API.trees = function () {
  return API.json("/api/family-trees").then(function (d) {
    return (d && d.trees) || [];
  });
};

API.chat = function (characterId, messages, provider, apiKey) {
  const headers = { "Content-Type": "application/json" };
  const body = { characterId: characterId, messages: messages };
  if (provider) {
    headers["x-provider"] = provider;
    body.provider = provider;
  }
  if (apiKey) headers["x-api-key"] = apiKey;
  return fetch("/api/chat", {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body)
  }).then(function (res) {
    return res.json().catch(function () { throw new Error("/api/chat -> " + res.status); });
  });
};
