export interface XmlNode {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};

export function parseXml(source: string): XmlNode {
  const parser = new XmlParser(source);

  return parser.parse();
}

class XmlParser {
  private index = 0;
  private readonly source: string;

  constructor(source: string) {
    this.source = source;
  }

  parse(): XmlNode {
    const root: XmlNode = { name: '#document', attributes: {}, children: [] };
    const stack: XmlNode[] = [root];

    while (this.index < this.source.length) {
      const char = this.source[this.index];

      if (char === '<') {
        if (this.source.startsWith('<!--', this.index)) {
          this.skipUntil('-->');
          continue;
        }

        if (this.source.startsWith('<![CDATA[', this.index)) {
          this.skipUntil(']]>');
          continue;
        }

        if (this.source.startsWith('<?', this.index)) {
          this.skipUntil('?>');
          continue;
        }

        if (this.source.startsWith('<!', this.index)) {
          this.skipDeclaration();
          continue;
        }

        if (this.source.startsWith('</', this.index)) {
          const closeIndex = this.source.indexOf('>', this.index);

          if (stack.length > 1) {
            stack.pop();
          }

          this.index = closeIndex === -1 ? this.source.length : closeIndex + 1;
          continue;
        }

        const element = this.readElement();

        if (element === null) {
          break;
        }

        const parent = stack[stack.length - 1];

        if (parent !== undefined) {
          parent.children.push(element.node);
        }

        if (!element.selfClosing) {
          stack.push(element.node);
        }

        continue;
      }

      this.index += 1;
    }

    return root;
  }

  private readElement(): { node: XmlNode; selfClosing: boolean } | null {
    const start = this.index + 1;
    let cursor = start;

    while (cursor < this.source.length && !/[\s/>]/.test(this.source[cursor] ?? '')) {
      cursor += 1;
    }

    const rawName = this.source.slice(start, cursor);

    if (rawName === '') {
      this.index += 1;
      return null;
    }

    const node: XmlNode = {
      name: localName(rawName),
      attributes: {},
      children: [],
    };

    let selfClosing = false;

    while (cursor < this.source.length) {
      while (/\s/.test(this.source[cursor] ?? '')) {
        cursor += 1;
      }

      const char = this.source[cursor];

      if (char === '>') {
        cursor += 1;
        break;
      }

      if (char === '/') {
        selfClosing = true;
        cursor += 1;
        continue;
      }

      if (char === undefined) {
        break;
      }

      const nameStart = cursor;

      while (
        cursor < this.source.length &&
        !/[\s=/>]/.test(this.source[cursor] ?? '')
      ) {
        cursor += 1;
      }

      const attributeName = this.source.slice(nameStart, cursor);

      while (/\s/.test(this.source[cursor] ?? '')) {
        cursor += 1;
      }

      if (this.source[cursor] === '=') {
        cursor += 1;

        while (/\s/.test(this.source[cursor] ?? '')) {
          cursor += 1;
        }

        const quote = this.source[cursor];

        if (quote === '"' || quote === "'") {
          const valueStart = cursor + 1;
          const valueEnd = this.source.indexOf(quote, valueStart);
          const rawValue =
            valueEnd === -1
              ? this.source.slice(valueStart)
              : this.source.slice(valueStart, valueEnd);

          node.attributes[localAttributeName(attributeName)] = decodeEntities(rawValue);
          cursor = valueEnd === -1 ? this.source.length : valueEnd + 1;
        } else {
          const valueStart = cursor;

          while (
            cursor < this.source.length &&
            !/[\s/>]/.test(this.source[cursor] ?? '')
          ) {
            cursor += 1;
          }

          node.attributes[localAttributeName(attributeName)] = decodeEntities(
            this.source.slice(valueStart, cursor),
          );
        }
      } else if (attributeName !== '') {
        node.attributes[localAttributeName(attributeName)] = '';
      }
    }

    this.index = cursor;

    return { node, selfClosing };
  }

  private skipUntil(terminator: string): void {
    const end = this.source.indexOf(terminator, this.index);

    this.index = end === -1 ? this.source.length : end + terminator.length;
  }

  private skipDeclaration(): void {
    let cursor = this.index + 2;
    let depth = 0;

    while (cursor < this.source.length) {
      const char = this.source[cursor];

      if (char === '[') {
        depth += 1;
      } else if (char === ']') {
        depth = Math.max(0, depth - 1);
      } else if (char === '>' && depth === 0) {
        cursor += 1;
        break;
      }

      cursor += 1;
    }

    this.index = cursor;
  }
}

function localName(name: string): string {
  const colon = name.indexOf(':');

  return (colon === -1 ? name : name.slice(colon + 1)).toLowerCase();
}

function localAttributeName(name: string): string {
  const colon = name.indexOf(':');
  const local = colon === -1 ? name : name.slice(colon + 1);

  return local.toLowerCase();
}

function decodeEntities(value: string): string {
  if (!value.includes('&')) {
    return value;
  }

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);

      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }

    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);

      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }

    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}
