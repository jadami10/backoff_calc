const ANALYTICS_SCRIPT_ID = "cloudflare-analytics-script";
const ANALYTICS_SCRIPT_SRC = "https://static.cloudflareinsights.com/beacon.min.js";
const ANALYTICS_BEACON_TOKEN = "891925f0a47d4c24b8f3161ff50809f1";

let analyticsScheduled = false;

/**
 * @param {string} id
 * @param {string} src
 * @param {Record<string, string>} [attributes]
 */
function appendScript(id, src, attributes = {}) {
  const existing = document.querySelector(`#${id}`);
  if (existing instanceof HTMLScriptElement) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;

    for (const [name, value] of Object.entries(attributes)) {
      script.setAttribute(name, value);
    }

    script.addEventListener("load", () => {
      resolve(script);
    });
    script.addEventListener("error", () => {
      reject(new Error(`Failed to load script: ${src}`));
    });

    document.head.append(script);
  });
}

function loadAnalyticsBeacon() {
  if (document.querySelector(`#${ANALYTICS_SCRIPT_ID}`) != null) {
    return;
  }

  const dnt = navigator.doNotTrack ?? window.doNotTrack ?? navigator.msDoNotTrack;
  if (dnt === "1") {
    return;
  }

  void appendScript(ANALYTICS_SCRIPT_ID, ANALYTICS_SCRIPT_SRC, {
    "data-cf-beacon": JSON.stringify({ token: ANALYTICS_BEACON_TOKEN }),
  }).catch((error) => {
    console.error("Cloudflare analytics failed to load.", error);
  });
}

export function scheduleAnalyticsBeaconLoad() {
  if (analyticsScheduled) {
    return;
  }
  analyticsScheduled = true;

  const schedule = () => {
    if ("requestIdleCallback" in window && typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => {
        loadAnalyticsBeacon();
      });
      return;
    }
    setTimeout(() => {
      loadAnalyticsBeacon();
    }, 2000);
  };

  if (document.readyState === "complete") {
    schedule();
    return;
  }

  window.addEventListener(
    "load",
    () => {
      schedule();
    },
    { once: true },
  );
}
