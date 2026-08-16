#!/usr/bin/env node
import { readAppVersion, syncIosPbxproj } from './read-app-version.mjs';

const version = readAppVersion();
syncIosPbxproj(version);
console.log(`[app-version] source unique → ${version.name} (${version.code})`);
