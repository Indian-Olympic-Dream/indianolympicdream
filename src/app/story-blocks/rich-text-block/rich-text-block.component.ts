import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { CommonModule } from "@angular/common";
import { SafePipe } from "../../safepipe";

// Define basic interfaces for type safety
interface TextNode {
  type: "text";
  text: string;
  format: number;
}

interface ElementNode {
  type:
    | "paragraph"
    | "root"
    | "heading"
    | "link"
    | "list"
    | "listitem"
    | "horizontalrule"
    | string;
  children: EditorNode[];
  [key: string]: any;
}

type EditorNode = TextNode | ElementNode;

@Component({
  selector: "app-rich-text-block",
  standalone: true,
  imports: [CommonModule, SafePipe],
  template: `<div
    class="rich-text-content"
    [innerHTML]="serializedContent | safe"
  ></div>`,
  styles: [
    `
      :host {
        display: block;
        font-family: "Geist Sans", sans-serif;
        font-size: 1.125rem;
        line-height: 1.7;
        font-weight: 400;
        max-width: 65ch;
        margin: 0 auto;
        padding: 0 1rem;
      }
    `,
  ],
})
export class RichTextBlockComponent implements OnChanges {
  @Input() block: any;
  serializedContent: string = "";

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["block"] && this.block?.content?.root) {
      this.serializedContent = this.serializeNode(this.block.content.root);
    }
  }

  private serializeNode(node: EditorNode): string {
    if (node.type === "text") {
      return this.renderTextNode(node as TextNode);
    }

    const elementNode = node as ElementNode;
    const childrenHtml = this.serializeChildren(elementNode);

    const format = elementNode.format;
    const alignClass = format ? `class="text-${format}"` : "";

    switch (elementNode.type) {
      case "root":
        return childrenHtml;
      case "paragraph":
        return `<p ${alignClass}>${childrenHtml}</p>`;
      case "heading":
        const tag = elementNode.tag || "h2";
        return `<${tag} ${alignClass}>${childrenHtml}</${tag}>`;
      case "list":
        const listTag = elementNode.tag || "ul";
        if (elementNode.listType === "check") {
          return `<ul class="check-list">${childrenHtml}</ul>`;
        }
        return `<${listTag}>${childrenHtml}</${listTag}>`;
      case "listitem":
        if (elementNode.checked !== undefined) {
          const checkedAttr = elementNode.checked ? "checked" : "";
          return `<li class="checklist-item"><input type="checkbox" disabled ${checkedAttr}><span>${childrenHtml}</span></li>`;
        }
        return `<li>${childrenHtml}</li>`;
      case "link":
        return this.renderLinkNode(elementNode);
      case "horizontalrule":
        return "<hr>";
      default:
        return childrenHtml;
    }
  }

  private serializeChildren(node: ElementNode): string {
    return (
      node.children?.map((child) => this.serializeNode(child)).join("") || ""
    );
  }

  private renderTextNode(node: TextNode): string {
    let text = this.escapeHtml(node.text);
    if ((node.format & 1) !== 0) {
      text = `<strong>${text}</strong>`;
    }
    if ((node.format & 2) !== 0) {
      text = `<em>${text}</em>`;
    }
    if ((node.format & 8) !== 0) {
      text = `<u>${text}</u>`;
    }
    if ((node.format & 64) !== 0) {
      text = `<sup>${text}</sup>`;
    }
    return text;
  }

  private renderLinkNode(node: ElementNode): string {
    const fields = node.fields;
    const text = this.serializeChildren(node);

    if (!fields?.url) {
      return text;
    }

    const targetRel = fields.newTab
      ? 'target="_blank" rel="noopener noreferrer"'
      : "";
    const linkClass = fields.newTab ? 'class="external-link"' : "";
    const linkContent = `${text}<span class="external-link-icon"></span>`;

    return `<a href="${this.escapeHtml(fields.url)}" ${targetRel} ${linkClass}>${linkContent}</a>`;
  }

  private escapeHtml(text: string): string {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
