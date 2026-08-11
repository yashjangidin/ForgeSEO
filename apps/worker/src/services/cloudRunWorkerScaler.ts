import { workerConfig } from "../config.js";

interface MetadataTokenResponse {
  access_token?: string;
}

const metadataTokenUrl = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

const getAccessToken = async (): Promise<string> => {
  const response = await fetch(metadataTokenUrl, {
    headers: {
      "Metadata-Flavor": "Google"
    }
  });

  if (!response.ok) {
    throw new Error(`Cloud Run metadata token request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as MetadataTokenResponse;
  if (!payload.access_token) {
    throw new Error("Cloud Run metadata token response did not include an access token.");
  }

  return payload.access_token;
};

export const scaleWorkerPool = async (instanceCount: number): Promise<void> => {
  const { projectId, region, workerPool, workerAutoscale } = workerConfig.cloudRun;
  if (!workerAutoscale || !projectId || !region || !workerPool) {
    return;
  }

  const accessToken = await getAccessToken();
  const url = new URL(`https://run.googleapis.com/v2/projects/${projectId}/locations/${region}/workerPools/${workerPool}`);
  url.searchParams.set("updateMask", "scaling.manualInstanceCount");

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      scaling: {
        manualInstanceCount: instanceCount
      }
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Cloud Run worker pool scaling failed with HTTP ${response.status}: ${message}`);
  }
};
