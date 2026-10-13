import fs from 'fs';
import os from 'os';
import path from 'path';
import { findSdkArchive, findSdkElsewhere, sdkStatus, sdkMissingAdvice } from '../nwrfc';
import { checkRfcSdk } from '../../selfCheck';

// SAP ships one ZIP per platform with look-alike names (nwrfc750P_20-80008131.zip was the
// macOS one on this machine, nwrfc750P_20-70002755.zip the Windows one): the index at the
// end of the ZIP tells them apart.
function io(files: Record<string, { tail: string; mtime: number }>) {
  return {
    list: (dir: string) => Object.keys(files).filter(f => path.posix.dirname(f) === dir).map(f => path.posix.basename(f)),
    tail: (file: string) => Buffer.from(files[file].tail),
    mtime: (file: string) => files[file].mtime,
  };
}
const MAC = 'nwrfcsdk/lib/libicuuc57.dylib nwrfcsdk/lib/libsapnwrfc.dylib';
const WIN = 'nwrfcsdk/lib/icuuc57.dll nwrfcsdk/lib/sapnwrfc.dll';

describe('findSdkArchive', () => {
  const files = {
    '/home/u/Downloads/nwrfc750P_20-70002755.zip': { tail: WIN, mtime: 2 },
    '/home/u/Downloads/nwrfc750P_20-80008131.zip': { tail: MAC, mtime: 1 },
    '/home/u/Downloads/other.zip': { tail: MAC, mtime: 3 },
  };

  it('picks the ZIP that holds the library of this platform', () => {
    expect(findSdkArchive('darwin', '/home/u', io(files))?.file).toBe('/home/u/Downloads/nwrfc750P_20-80008131.zip');
    expect(findSdkArchive('linux', '/home/u', io(files))).toBeUndefined();
  });

  it('unpacks into the configured nwrfcsdk folder when there is one, else into ~/sap with a setting to add', () => {
    const into = findSdkArchive('darwin', '/home/u', io(files), '/home/u/sap/nwrfcsdk')!;
    expect(into.instruction).toBe('unpack it with: unzip -o "/home/u/Downloads/nwrfc750P_20-80008131.zip" -d "/home/u/sap", which recreates /home/u/sap/nwrfcsdk where systems.json points; then restart the MCP server.');
    const fresh = findSdkArchive('darwin', '/home/u', io(files))!;
    expect(fresh.sdkPath).toBe('/home/u/sap/nwrfcsdk');
    expect(fresh.instruction).toMatch(/set "sdkPath": "\/home\/u\/sap\/nwrfcsdk" in the rfc block of systems.json/);
  });

  it('on Windows unpacks to C:\\ so the default C:\\nwrfcsdk applies', () => {
    const w = findSdkArchive('win32', 'C:\\Users\\u', {
      list: (dir: string) => (dir === 'C:\\Users\\u\\Downloads' ? ['nwrfc750P_20-70002755.zip'] : []),
      tail: () => Buffer.from(WIN), mtime: () => 1,
    })!;
    expect(w.instruction).toMatch(/Expand-Archive -Path "C:\\Users\\u\\Downloads\\nwrfc750P_20-70002755.zip" -DestinationPath C:\\/);
  });

  it('skips folders that cannot be read and ZIPs that fail to open', () => {
    const broken = { list: () => { throw new Error('EACCES'); }, tail: () => { throw new Error('x'); }, mtime: () => 0 };
    expect(findSdkArchive('darwin', '/home/u', broken)).toBeUndefined();
  });
});

describe('findSdkElsewhere', () => {
  it('finds an unpacked SDK in a usual folder other than the configured one', () => {
    const exists = (f: string) => f === '/home/u/nwrfcsdk/lib/libsapnwrfc.dylib';
    expect(findSdkElsewhere('darwin', '/home/u', '/home/u/sap/nwrfcsdk', exists)).toBe('/home/u/nwrfcsdk');
    expect(findSdkElsewhere('darwin', '/home/u', '/home/u/nwrfcsdk', exists)).toBeUndefined();
  });
});

describe('sdkStatus', () => {
  it('reports a library in place and a missing one with what to do', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-'));
    const lib = process.platform === 'darwin' ? 'libsapnwrfc.dylib' : process.platform === 'win32' ? 'sapnwrfc.dll' : 'libsapnwrfc.so';
    fs.mkdirSync(path.join(home, 'nwrfcsdk', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(home, 'nwrfcsdk', 'lib', lib), '');
    const ok = sdkStatus(path.join(home, 'nwrfcsdk'), { homedir: home });
    expect(ok).toMatchObject({ found: true, libraryPath: path.join(home, 'nwrfcsdk', 'lib', lib), source: 'rfc.sdkPath' });

    // Configured folder empty, but ~/nwrfcsdk (a usual folder) holds the library.
    const misplaced = sdkStatus(path.join(home, 'gone'), { homedir: home });
    expect(misplaced.found).toBe(false);
    expect(misplaced.lookedFor[0]).toBe(path.join(home, 'gone', 'lib', lib));
    expect(misplaced.elsewhere).toBe(path.join(home, 'nwrfcsdk'));
    expect(sdkMissingAdvice(misplaced)).toMatch(/unpacked at .*nwrfcsdk: set rfc.sdkPath/);

    fs.rmSync(path.join(home, 'nwrfcsdk'), { recursive: true, force: true });
    const missing = sdkStatus(path.join(home, 'gone'), { homedir: home });
    expect(missing.elsewhere).toBeUndefined();
    expect(missing.archive).toBeUndefined();
    expect(sdkMissingAdvice(missing)).toMatch(/Download the SAP NetWeaver RFC SDK 7.50 with your own S-user.*not bundled/);
    fs.rmSync(home, { recursive: true, force: true });
  });
});

describe('checkRfcSdk (--check)', () => {
  const sys: any = { name: 'P03', transport: 'rfc', rfc: { sdkPath: '~/sap/nwrfcsdk' } };
  it('passes with the library path and fails with the advice', () => {
    expect(checkRfcSdk(sys, {}, () => ({ found: true, libraryPath: '/x/lib/libsapnwrfc.dylib', source: 'rfc.sdkPath', lookedFor: [] })))
      .toEqual({ level: 'ok', text: 'P03: RFC SDK found at /x/lib/libsapnwrfc.dylib (from rfc.sdkPath)' });
    const fail = checkRfcSdk(sys, {}, () => ({ found: false, source: 'rfc.sdkPath', lookedFor: ['/x/lib/libsapnwrfc.dylib'], elsewhere: '/opt/sap/nwrfcsdk' }));
    expect(fail.level).toBe('fail');
    expect(fail.text).toMatch(/^P03 uses transport "rfc" and the SAP NetWeaver RFC SDK is missing: looked for \/x\/lib\/libsapnwrfc.dylib.*unpacked at \/opt\/sap\/nwrfcsdk/);
  });
});
