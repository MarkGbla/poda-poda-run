const test=require('node:test');
const assert=require('node:assert/strict');
const {database,request}=require('./helpers/account-db.cjs');
test('signed Google identity validates signature, issuer, audience, expiry and nonce',async()=>{
  const {generateKeyPair,SignJWT}=await import('jose');
  const {verifyGoogleIdentity}=await import('../server/auth/google.mjs');
  const pair=await generateKeyPair('RS256'),other=await generateKeyPair('RS256');
  async function token({issuer='https://accounts.google.com',aud='client',nonce='nonce',exp='5m'}={}) {
    return new SignJWT({nonce}).setProtectedHeader({alg:'RS256'}).setSubject('stable-google-sub').setIssuer(issuer).setAudience(aud).setIssuedAt().setExpirationTime(exp).sign(pair.privateKey);
  }
  assert.equal(await verifyGoogleIdentity(await token(),'client','nonce',pair.publicKey),'stable-google-sub');
  await assert.rejects(verifyGoogleIdentity(await token(),'client','wrong',pair.publicKey));
  await assert.rejects(verifyGoogleIdentity(await token({aud:'attacker'}),'client','nonce',pair.publicKey));
  await assert.rejects(verifyGoogleIdentity(await token({issuer:'https://evil.test'}),'client','nonce',pair.publicKey));
  await assert.rejects(verifyGoogleIdentity(await token({exp:1}),'client','nonce',pair.publicKey));
  await assert.rejects(verifyGoogleIdentity(await token(),'client','nonce',other.publicKey));
});
test('real OAuth callback flow checks PKCE, consumes state once and deduplicates Google subject',async()=>{
  const {generateKeyPair,exportJWK,SignJWT}=await import('jose');
  const {hash}=await import('../server/auth/session.mjs');
  const worker=(await import('../server/worker.mjs')).default;
  const pair=await generateKeyPair('RS256',{extractable:true});
  const jwk=await exportJWK(pair.publicKey);jwk.kid='test-key';jwk.alg='RS256';
  const DB=database(),env={DB,PUBLIC_ORIGIN:'https://podapodarun.com',GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret'};
  const original=global.fetch;let nonce, verifier, exchanges=0;
  global.fetch=async(url,options)=>{
    if(String(url).includes('/certs'))return Response.json({keys:[jwk]});
    assert.equal(String(url),'https://oauth2.googleapis.com/token');
    const form=new URLSearchParams(options.body);assert.equal(form.get('code_verifier'),verifier);
    assert.equal(form.get('redirect_uri'),'https://podapodarun.com/api/auth/google/callback');
    exchanges++;
    const id_token=await new SignJWT({nonce,email:'private@example.test',name:'Private Name'}).setProtectedHeader({alg:'RS256',kid:'test-key'})
      .setSubject('same-sub').setIssuer('https://accounts.google.com').setAudience('test-client').setIssuedAt().setExpirationTime('5m').sign(pair.privateKey);
    return Response.json({access_token:'not-stored',token_type:'Bearer',expires_in:3600,id_token});
  };
  try {
    for(let i=0;i<2;i++) {
      const start=await worker.fetch(request('/api/auth/google'),env);
      const target=new URL(start.headers.get('location')), state=target.searchParams.get('state');
      assert.equal(target.searchParams.get('scope'),'openid');assert.equal(target.searchParams.get('code_challenge_method'),'S256');
      nonce=target.searchParams.get('nonce');
      verifier=DB.sql.prepare('SELECT verifier FROM oauth_attempts WHERE state_hash=?').get(await hash(state)).verifier;
      const browserCookie=start.headers.get('set-cookie').split(';')[0];
      const callback='/api/auth/google/callback?state='+encodeURIComponent(state)+'&code=code';
      const bad=await worker.fetch(request(callback,null,undefined,{cookie:'__Host-poda-oauth='+'0'.repeat(64)}),env);
      assert.equal(bad.headers.get('location'),'/?account=error');
      const response=await worker.fetch(request(callback,null,undefined,{cookie:browserCookie}),env);
      assert.equal(response.headers.get('location'),'/?account=signed-in');
      assert.ok(response.headers.getSetCookie().some(c=>c.startsWith('__Host-poda-session=')&&c.includes('HttpOnly')&&c.includes('Secure')));
      const replay=await worker.fetch(request(callback,null,undefined,{cookie:browserCookie}),env);
      assert.equal(replay.headers.get('location'),'/?account=error');
    }
    assert.equal(exchanges,2);assert.equal(DB.sql.prepare('SELECT COUNT(*) n FROM players').get().n,1);
    assert.equal(DB.sql.prepare('SELECT driver_name FROM players').get().driver_name,null);
    assert.ok(!JSON.stringify(DB.sql.prepare('SELECT * FROM players').all()).includes('private@example.test'));
  } finally {global.fetch=original;}
});
