/* api.js — backend client; falls back to local-only when server unreachable */
(function () {
  const TOKEN_KEY = "network_admin_token";

  function baseUrl() {
    if (typeof window.NETWORK_API_BASE === "string") return window.NETWORK_API_BASE.replace(/\/$/, "");
    return "";
  }

  async function request(path, opts = {}) {
    const url = baseUrl() + "/api" + path;
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = "Bearer " + token;
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText || "request failed");
    return data;
  }

  async function requestMultipart(path, formData, method = "POST") {
    const url = baseUrl() + "/api" + path;
    const headers = {};
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = "Bearer " + token;
    const res = await fetch(url, { method, body: formData, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText || "request failed");
    return data;
  }

  let _config = null;
  let _online = null;

  async function probe() {
    try {
      const cfg = await request("/config");
      _config = cfg;
      _online = true;
      return cfg;
    } catch (e) {
      _online = false;
      _config = null;
      return null;
    }
  }

  window.NETWORK_API = {
    TOKEN_KEY,
    probe,
    isOnline() { return _online === true; },
    getConfig() { return _config; },

    async login(password) {
      const data = await request("/admin/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      sessionStorage.setItem(TOKEN_KEY, data.token);
      sessionStorage.setItem("admin_ok", "1");
      return data;
    },

    logout() {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem("admin_ok");
    },

    async fetchLog() {
      return request("/log");
    },

    async fetchProjects() {
      return request("/projects");
    },

    async spawnProject(formData) {
      return requestMultipart("/projects", formData);
    },

    async hireAgent(projectKey, formData) {
      return requestMultipart("/projects/" + encodeURIComponent(projectKey) + "/agents", formData);
    },

    async inject(entry) {
      const data = await request("/log", {
        method: "POST",
        body: JSON.stringify(entry),
      });
      return data.entry;
    },

    async update(id, patch) {
      const data = await request("/log/" + encodeURIComponent(id), {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      return data.entry;
    },

    async remove(id) {
      return request("/log/" + encodeURIComponent(id), { method: "DELETE" });
    },

    async generate({ brief, tag, target }) {
      return request("/admin/generate", {
        method: "POST",
        body: JSON.stringify({ brief, tag, target }),
      });
    },
  };
})();
