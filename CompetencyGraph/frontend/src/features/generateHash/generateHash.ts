async function hashString(str: string, algorithm: string = 'SHA-256'): Promise<string> {
  const msgBuffer = new TextEncoder().encode(str);
  
  const hashBuffer = await crypto.subtle.digest(algorithm, msgBuffer);
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

export { hashString };