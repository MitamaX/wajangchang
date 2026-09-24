const SCRIPT_TYPE = 'text/javascript';

async function download({ url, bytes }, onProgress) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    chunks.push(chunk.value);
    received += chunk.value.byteLength;
    onProgress(Math.min(1, received / bytes));
  }
  return new Blob(chunks, { type: SCRIPT_TYPE });
}

export async function loadModule(source, onProgress) {
  const address = URL.createObjectURL(await download(source, onProgress));
  try {
    return await import(/* @vite-ignore */ address);
  } finally {
    URL.revokeObjectURL(address);
  }
}
