

export interface SpamValidation {
  score: number;
  warnings: string[];
}

export interface LinterIssue {
  type: 'error' | 'warning' | 'pass';
  title: string;
  consequence: string;
  codeSnippet?: string;
  lineNum?: number;
}

export interface LinterValidation {
  passedCount: number;
  warningsCount: number;
  errorsCount: number;
  issues: LinterIssue[];
}

export interface ValidationResult {
  css: CSSValidation;
  links: LinkValidation;
  performance: PerformanceMetrics;
  clientCompatibility: ClientCompatibility;
  spam: SpamValidation;
  linter: LinterValidation;
}

export interface CSSValidation {
  unsupportedProperties: string[];
  warnings: string[];
  score: number; // 0-100
}

export interface LinkValidation {
  totalLinks: number;
  externalLinks: string[];
  issues: string[];
  score: number;
}

export interface PerformanceMetrics {
  totalSize: number; // en bytes
  htmlSize: number;
  cssSize: number;
  imageCount: number;
  imageSize: number;
  renderTime: number; // estimado en ms
  score: number; // 0-100
  warnings: string[];
}

export interface ClientCompatibility {
  gmail: number; // 0-100
  outlook: number;
  appleMail: number;
  samsungMail: number;
  average: number;
}

export class EmailValidator {
 
  private unsupportedCSSProperties = [
    'animation',
    'transform',
    'transition',
    'position: fixed',
    'position: sticky',
    '@supports',
    '@media print',
    'calc()',
    'var()',
    'grid',
    'gap',
    'display: flex',
    '@import',
    'position: absolute',
  ];

  validate(html: string, text: string, subject: string = ''): ValidationResult {
    return {
      css: this.validateCSS(html),
      links: this.validateLinks(html),
      performance: this.validatePerformance(html, text),
      clientCompatibility: this.analyzeClientCompatibility(html),
      spam: this.validateSpam(html, text, subject),
      linter: this.validateLinter(html, text)
    };
  }

  private validateLinter(html: string, text: string): LinterValidation {
    const issues: LinterIssue[] = [];
    let passedCount = 0;
    let warningsCount = 0;
    let errorsCount = 0;

    const addIssue = (condition: boolean, title: string, consequence: string, isError: boolean = false, codeSnippet?: string, lineNum?: number) => {
      if (condition) {
        issues.push({ type: isError ? 'error' : 'warning', title, consequence, codeSnippet, lineNum });
        isError ? errorsCount++ : warningsCount++;
      } else {
        issues.push({ type: 'pass', title, consequence });
        passedCount++;
      }
    };

    const lines = html.split('\\n');
    const findLine = (pattern: RegExp | string): { text: string, num: number } | null => {
      const idx = lines.findIndex(l => typeof pattern === 'string' ? l.includes(pattern) : pattern.test(l));
      return idx >= 0 ? { text: lines[idx].trim(), num: idx + 1 } : null;
    };

    // 1. Sin link de unsubscribe
    const hasUnsubscribe = /unsubscribe|desuscribir|baja|opt-out/i.test(html);
    addIssue(!hasUnsubscribe, 'Sin link de unsubscribe', 'Riesgo de Spam legal en EEUU/EU (CAN-SPAM/GDPR)');

    // 2. Variable vacía {{}} o {{nombre}}
    const varMatch = findLine(/\\{\\{.*?\\}\\}/) || findLine(/\\[\\[.*?\\]\\]/);
    addIssue(!!varMatch, 'Variable tipo {{ }} sin renderizar', 'El usuario ve código roto o plantillas vacías', false, varMatch?.text, varMatch?.num);

    // 3. Solo HTML, sin texto plano
    addIssue(!text || text.trim().length === 0, 'Solo HTML, sin texto plano', 'Filtros de spam te bajan score. Outlook a veces prefiere texto plano', true);

    // 4. Imágenes sin alt text
    const imgRegex = /<img([^>]+)>/gi;
    let match;
    let missingAltLine = null;
    while ((match = imgRegex.exec(html)) !== null) {
      if (!/alt=["'](.*?)["']/i.test(match[1])) {
        missingAltLine = findLine(match[0]);
        break;
      }
    }
    addIssue(!!missingAltLine, 'Imágenes sin alt text', 'Outlook las bloquea por defecto, y quedarán cuadros vacíos', false, missingAltLine?.text, missingAltLine?.num);

    // 5. Email pesa +102kb
    const htmlSize = Buffer.byteLength(html, 'utf8');
    addIssue(htmlSize > 104448, 'HTML pesa más de 102kb', 'Gmail corta el correo con el botón "Ver mensaje completo"', true);

    // 6. Fuentes de Google Fonts
    const fontsMatch = findLine(/fonts\\.googleapis\\.com/);
    addIssue(!!fontsMatch, 'Uso de Google Fonts', 'Outlook y muchos clientes web las ignoran completamente (usa fallback fonts)', false, fontsMatch?.text, fontsMatch?.num);

    // 7. Sin viewport meta tag
    const hasViewport = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html);
    addIssue(!hasViewport, 'Sin viewport meta tag', 'En clientes móviles (iOS/Android) se verá con zoom extraño o roto', true);

    // 8. Links sin tracking
    const hasTracking = /utm_source|utm_medium|utm_campaign/i.test(html);
    const hasAnyLink = /href=["']http/i.test(html);
    if (hasAnyLink) {
      const linkNoTracking = findLine(/href=["']http[^"']*["']/i); // Aprox a un link cualquiera para dar contexto
      addIssue(!hasTracking, 'Links sin tracking (UTM)', 'No podrás medir si alguien abrió o clickeó nada en Analytics', false, linkNoTracking?.text, linkNoTracking?.num);
    }

    return { passedCount, warningsCount, errorsCount, issues };
  }

  private validateCSS(html: string): CSSValidation {
    const issues: string[] = [];
    let score = 100;

   
    const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    const inlineStyles = html.match(/style=["']([^"']*)["']/gi);

    let cssContent = '';
    if (styleMatch) {
      cssContent += styleMatch.join(' ');
    }
    if (inlineStyles) {
      cssContent += inlineStyles.join(' ');
    }

    // Validar propiedades no soportadas
    const unsupported: string[] = [];
    const lines = html.split('\n');
    this.unsupportedCSSProperties.forEach(prop => {
      if (cssContent.toLowerCase().includes(prop.toLowerCase())) {
        unsupported.push(prop);
        score -= 5;
        const lineNum = lines.findIndex(l => l.toLowerCase().includes(prop.toLowerCase())) + 1;
        issues.push(` Línea ${lineNum > 0 ? lineNum : '?'}: '${prop}' no es soportado completamente en todos los clientes`);
      }
    });

   
    if (cssContent.includes('@media')) {
      issues.push(' Media queries pueden no funcionar en algunos clientes');
      score -= 3;
    }

    // Detectar webfonts
    if (cssContent.includes('@font-face') || cssContent.includes('fonts.googleapis')) {
      issues.push(' Webfonts pueden no cargar en Outlook y Gmail');
      score -= 5;
    }

    score = Math.max(0, score);

    return {
      unsupportedProperties: unsupported,
      warnings: issues,
      score,
    };
  }

  private validateLinks(html: string): LinkValidation {
    const links: string[] = [];
    const issues: string[] = [];
    let score = 100;

    // Extraer todos los links
    const linkRegex = /href=["']([^"']*)["']/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      links.push(match[1]);
    }

    const externalLinks = links.filter(link => link.startsWith('http'));

    const lines = html.split('\n');
    // Validar URLs
    externalLinks.forEach(url => {
      const lineNum = lines.findIndex(l => l.includes(url)) + 1;
      if (!this.isValidURL(url)) {
        issues.push(` Línea ${lineNum > 0 ? lineNum : '?'}: URL inválida o rota: ${url}`);
        score -= 10;
      } else if (!url.startsWith('https')) {
        issues.push(` Línea ${lineNum > 0 ? lineNum : '?'}: URL sin HTTPS: ${url}`);
        score -= 3;
      }
    });

    const emptyLinks = links.filter(l => !l || l === '#' || l.trim() === '');
    if (emptyLinks.length > 0) {
      const lineNum = lines.findIndex(l => l.includes('href="#"') || l.includes('href=""') || l.includes("href=''")) + 1;
      issues.push(` Línea ${lineNum > 0 ? lineNum : '?'}: ${emptyLinks.length} enlace(s) rotos o vacíos (href="#" o sin URL)`);
      score -= emptyLinks.length * 5;
    }

    // Detectar tracking pixels
    const trackingPixels = html.match(/<img[^>]+src=["']([^"']*?)["'][^>]*width=["']?1["']?[^>]*height=["']?1["']?/gi);
    if (trackingPixels && trackingPixels.length > 0) {
      issues.push(` ${trackingPixels.length} tracking pixel(s) detectado(s)`);
    }

    score = Math.max(0, score);

    return {
      totalLinks: links.length,
      externalLinks,
      issues,
      score,
    };
  }

  private validatePerformance(html: string, text: string): PerformanceMetrics {
    const htmlSize = Buffer.byteLength(html, 'utf8');
    const textSize = Buffer.byteLength(text || '', 'utf8');

   
    const imageRegex = /<img[^>]+src=["']([^"']*)["']/gi;
    const images: string[] = [];
    let match;
    while ((match = imageRegex.exec(html)) !== null) {
      images.push(match[1]);
    }

    const estimatedImageSize = images.length * 50000;

    // Extraer CSS
    const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const cssSize = styleMatch ? Buffer.byteLength(styleMatch[1], 'utf8') : 0;

    const totalSize = htmlSize + estimatedImageSize;
    const renderTime = Math.min(2000, totalSize / 10); // ms estimados

    let score = 100;
    const warnings: string[] = [];

    // Warnings de performance
    if (htmlSize > 104448) { // 102KB limit for Gmail
      warnings.push(`✂️ Gmail recortará este email. El HTML puro pesa ${(htmlSize / 1024).toFixed(1)}KB (Límite: 102KB)`);
      score -= 30;
    }

    if (totalSize > 102400) {
      warnings.push(` Email completo muy pesado: ${(totalSize / 1024).toFixed(1)}KB (HTML + Imágenes estimadas)`);
      score -= 20;
    } else if (totalSize > 51200) {
      warnings.push(` Email pesado: ${(totalSize / 1024).toFixed(1)}KB`);
      score -= 10;
    }

    if (images.length > 10) {
      warnings.push(` Muchas imágenes: ${images.length} (máximo recomendado: 10)`);
      score -= 10;
    }

    if (cssSize > 10240) {
      warnings.push(` CSS muy grande: ${(cssSize / 1024).toFixed(1)}KB`);
      score -= 5;
    }

    // Detectar tablas anidadas (problemas de rendering)
    const tableCount = (html.match(/<table/gi) || []).length;
    const nestedTables = (html.match(/<table[^>]*>[\s\S]*<table/gi) || []).length;
    if (nestedTables > 3) {
      warnings.push(` ${nestedTables} tablas anidadas detectadas (pueden ser lentas de renderizar)`);
      score -= 10;
    }

    score = Math.max(0, score);

    return {
      totalSize,
      htmlSize,
      cssSize,
      imageCount: images.length,
      imageSize: estimatedImageSize,
      renderTime,
      score,
      warnings,
    };
  }

  private analyzeClientCompatibility(html: string): ClientCompatibility {
    // Análisis simplificado basado en características detectadas
    let gmailScore = 100;
    let outlookScore = 100;
    let appleScore = 100;
    let samsungScore = 100;

    // Gmail
    if (html.includes('background-image')) gmailScore -= 5;
    if (html.includes('@media')) gmailScore -= 5;
    if (html.includes('calc(')) gmailScore -= 10;

    // Outlook
    if (html.includes('transform')) outlookScore -= 15;
    if (html.includes('animation')) outlookScore -= 15;
    if (html.includes('@font-face')) outlookScore -= 10;
    if (html.includes('border-radius')) outlookScore -= 3;

    // Apple Mail
    if (html.includes('animation')) appleScore -= 10;

    // Samsung Mail
    if (html.includes('complex CSS')) samsungScore -= 5;

    return {
      gmail: Math.max(0, gmailScore),
      outlook: Math.max(0, outlookScore),
      appleMail: Math.max(0, appleScore),
      samsungMail: Math.max(0, samsungScore),
      average: Math.round((gmailScore + outlookScore + appleScore + samsungScore) / 4),
    };
  }

  private validateSpam(html: string, text: string, subject: string): SpamValidation {
    let score = 100;
    const warnings: string[] = [];

    // 1. Ratio texto/HTML
    if (!text || text.trim().length === 0) {
      warnings.push(`🚨 No hay versión de texto plano. Los filtros Anti-Spam penalizan esto severamente.`);
      score -= 20;
    }

    // 2. Alt text en imágenes
    const imgRegex = /<img([^>]+)>/gi;
    let match;
    let missingAlt = 0;
    let totalImages = 0;
    while ((match = imgRegex.exec(html)) !== null) {
      totalImages++;
      if (!/alt=["'](.*?)["']/i.test(match[1])) {
        missingAlt++;
      }
    }
    if (missingAlt > 0) {
      warnings.push(` ${missingAlt} de ${totalImages} imágenes no tienen atributo 'alt'. Malo para accesibilidad y filtros spam.`);
      score -= Math.min(20, missingAlt * 5);
    }

    // 3. Palabras de spam en subject
    const spamWords = ['gratis', 'free', 'urgent', 'urgente', 'gana', 'dinero', 'oferta', 'descuento', 'compra ahora'];
    const subjectLower = subject.toLowerCase();
    const foundSpamWords = spamWords.filter(word => subjectLower.includes(word));
    if (foundSpamWords.length > 0) {
      warnings.push(`📢 El asunto contiene palabras spammy: ${foundSpamWords.join(', ')}`);
      score -= foundSpamWords.length * 10;
    }

    return { score: Math.max(0, score), warnings };
  }

  private isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return url.startsWith('mailto:') || url.startsWith('#');
    }
  }
}
