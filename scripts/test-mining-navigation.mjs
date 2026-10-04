import test from 'node:test';
import assert from 'node:assert/strict';
import { greatCircleDistanceMeters } from '../lib/mining-navigation.js';

test('close mining deposit distance uses the body radius',()=>{
  const earthLike=greatCircleDistanceMeters(0,0,0,0.008,6371000);
  assert.ok(earthLike>880&&earthLike<900);
});

test('one-kilometer threshold can distinguish nearby and separate coordinates',()=>{
  const radius=1234567;
  const close=greatCircleDistanceMeters(-22.7738,-98.8161,-22.7900,-98.8161,radius);
  const far=greatCircleDistanceMeters(-22.7738,-98.8161,-22.8300,-98.8161,radius);
  assert.ok(close<1000);
  assert.ok(far>1000);
});

test('invalid radius cannot produce a false duplicate distance',()=>{
  assert.equal(greatCircleDistanceMeters(0,0,0,1,null),null);
});
