export function describeDevice(userAgent: string) {
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
  return { device: `${type} · ${os}`, browser };
}
