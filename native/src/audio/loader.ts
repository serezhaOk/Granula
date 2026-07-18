// Turning a file on disk into a decoded AudioBuffer. Prefer the native
// `decodeAudioDataSource(uri)` fast-path (react-native-audio-api reads and
// decodes the file off-thread); fall back to reading the bytes ourselves and
// calling decodeAudioData when that API is unavailable.

import * as FileSystem from "expo-file-system";

import { engine } from "./engine";

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  let bufferLength = (b64.length * 3) / 4;
  if (b64[b64.length - 1] === "=") bufferLength--;
  if (b64[b64.length - 2] === "=") bufferLength--;
  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < b64.length; i += 4) {
    const e1 = lookup[b64.charCodeAt(i)];
    const e2 = lookup[b64.charCodeAt(i + 1)];
    const e3 = lookup[b64.charCodeAt(i + 2)];
    const e4 = lookup[b64.charCodeAt(i + 3)];
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (p < bufferLength) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (p < bufferLength) bytes[p++] = ((e3 & 3) << 6) | e4;
  }
  return bytes.buffer;
}

export async function decodeUri(uri: string) {
  const ctx: any = engine.ctx;
  if (ctx && typeof ctx.decodeAudioDataSource === "function") {
    try {
      return await ctx.decodeAudioDataSource(uri);
    } catch {
      // fall through to manual read
    }
  }
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return engine.decode(base64ToArrayBuffer(b64));
}

// Copy an external/temporary file into the app's persistent sample store and
// return its stable uri. Extension is preserved so the decoder can sniff format.
export async function persistSampleFile(srcUri: string, hintName: string): Promise<string> {
  const dir = FileSystem.documentDirectory + "samples/";
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const extMatch = (srcUri.match(/\.[a-z0-9]+$/i) || hintName.match(/\.[a-z0-9]+$/i));
  const ext = extMatch ? extMatch[0] : ".m4a";
  const dest = dir + Date.now() + "-" + Math.floor(Math.random() * 1e6) + ext;
  await FileSystem.copyAsync({ from: srcUri, to: dest });
  return dest;
}
