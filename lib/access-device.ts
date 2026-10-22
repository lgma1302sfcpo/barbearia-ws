export type DeviceHints = {
  model?: string;
  platformVersion?: string;
  screen?: string;
};

// tamanho lógico da tela (retrato) -> modelos de iPhone que usam esse tamanho
const IPHONE_SCREENS: Record<string, string> = {
  '320x568': 'iPhone SE (1ª geração)',
  '375x667': 'iPhone SE / 6 / 7 / 8',
  '414x736': 'iPhone 6/7/8 Plus',
  '375x812': 'iPhone X / XS / 11 Pro / 12 mini / 13 mini',
  '414x896': 'iPhone XR / XS Max / 11 / 11 Pro Max',
  '390x844': 'iPhone 12 / 13 / 14',
  '428x926': 'iPhone 12 Pro Max / 13 Pro Max / 14 Plus',
  '393x852': 'iPhone 14 Pro / 15 / 15 Pro / 16',
  '430x932': 'iPhone 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus',
  '402x874': 'iPhone 16 Pro / 17 / 17 Pro',
  '440x956': 'iPhone 16 Pro Max / 17 Pro Max',
  '420x912': 'iPhone Air',
};

function osVersion(os: string, userAgent: string, platformVersion?: string) {
  const major = Number(platformVersion?.split('.')[0]);
  if (os === 'Windows') {
    // o user agent informa "Windows NT 10.0" tanto no 10 quanto no 11
    return platformVersion && Number.isFinite(major) ? (major >= 13 ? '11' : '10') : '';
  }
  if (os === 'iOS') {
    const match = /OS (\d+)[_.](\d+)/.exec(userAgent);
    return match ? `${match[1]}.${match[2]}` : '';
  }
  if (os === 'Android') {
    if (platformVersion) return platformVersion.split('.')[0];
    return /Android (\d+)/.exec(userAgent)?.[1] ?? '';
  }
  if (os === 'macOS' && platformVersion) return platformVersion.split('.').slice(0, 2).join('.');
  return '';
}

function deviceModel(os: string, type: string, userAgent: string, hints: DeviceHints) {
  if (hints.model) return hints.model;
  if (os === 'Android') {
    const model = /Android [\d.]+; ([^;)]+)/.exec(userAgent)?.[1]?.trim();
    // o Chrome recente troca o modelo por "K" no user agent
    return model && model !== 'K' ? model : '';
  }
  if (os === 'iOS' && type === 'Celular' && hints.screen) {
    const [width, height] = hints.screen.split('x').map(Number);
    const name = IPHONE_SCREENS[`${Math.min(width, height)}x${Math.max(width, height)}`];
    return name ? `Provável ${name}` : 'iPhone';
  }
  if (os === 'iOS' && type === 'Tablet') return 'iPad';
  return '';
}

export function describeDevice(userAgent: string, hints: DeviceHints = {}) {
  const os = /iPhone|iPad|iPod/i.test(userAgent)
    ? 'iOS'
    : /Android/i.test(userAgent)
      ? 'Android'
      : /Windows/i.test(userAgent)
        ? 'Windows'
        : /Macintosh|Mac OS X/i.test(userAgent)
          ? 'macOS'
          : /Linux/i.test(userAgent)
            ? 'Linux'
            : 'Sistema desconhecido';
  const type = /iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)
    ? 'Tablet'
    : /Mobile|iPhone|iPod/i.test(userAgent)
      ? 'Celular'
      : /Windows|Macintosh|Linux/i.test(userAgent)
        ? 'Computador'
        : 'Dispositivo desconhecido';
  const browser = /Edg(?:e|A|iOS)?\//i.test(userAgent)
    ? 'Edge'
    : /OPR\/|Opera|OPiOS\//i.test(userAgent)
      ? 'Opera'
      : /Firefox\/|FxiOS\//i.test(userAgent)
        ? 'Firefox'
        : /SamsungBrowser\//i.test(userAgent)
          ? 'Samsung Internet'
          : /Chrome\/|CriOS\//i.test(userAgent)
            ? 'Chrome'
            : /Safari\//i.test(userAgent)
              ? 'Safari'
              : 'Navegador desconhecido';
  const browserVersion = /(?:Edg(?:e|A|iOS)?|OPR|OPiOS|Firefox|FxiOS|SamsungBrowser|Chrome|CriOS|Version)\/(\d+)/i
    .exec(userAgent)?.[1];
  const version = osVersion(os, userAgent, hints.platformVersion);
  return {
    device: `${type} · ${os}${version ? ` ${version}` : ''}`,
    browser: browserVersion ? `${browser} ${browserVersion}` : browser,
    model: deviceModel(os, type, userAgent, hints),
  };
}
