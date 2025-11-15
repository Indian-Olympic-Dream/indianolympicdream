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
  type: "paragraph" | "root" | "heading" | "link" | string; // Allow other string types
  children: EditorNode[];
  [key: string]: any; // Allow other properties like tag, url
}

type EditorNode = TextNode | ElementNode;

@Component({
  selector: "app-rich-text-block",
  standalone: true,
  imports: [CommonModule, SafePipe],
  templateUrl: "./rich-text-block.component.html",
  styleUrls: ["./rich-text-block.component.scss"],
})
export class RichTextBlockComponent implements OnChanges {
  @Input() block: any;

  serializedContent: string = "";

  // The "Renderer Registry" maps node types to rendering functions.
  private readonly nodeRenderers: { [key: string]: (node: any) => string } = {
    root: (node) => this.serializeChildren(node),
    paragraph: (node) => `<p>${this.serializeChildren(node)}</p>`,
    text: (node) => this.renderTextNode(node),
    link: (node) => this.renderLinkNode(node),
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["block"] && this.block?.content?.root) {
      this.serializedContent = this.serializeNode(this.block.content.root);
    }
  }

  private serializeNode(node: EditorNode): string {
    const renderer = this.nodeRenderers[node.type];
    if (renderer) {
      return renderer(node);
    }
    return node.type !== "text"
      ? this.serializeChildren(node as ElementNode)
      : "";
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
    return text;
  }

  private renderLinkNode(node: ElementNode): string {
    const url = node.fields?.url;
    const newTab = node.fields?.newTab;
    const text = this.serializeChildren(node);

    if (!url) {
      return text;
    }

    const linkClass = newTab ? 'class="external-link"' : "";
    const targetRel = newTab ? 'target="_blank" rel="noopener noreferrer"' : "";

    return `<a href="${this.escapeHtml(url)}" ${targetRel} ${linkClass}>${text}</a>`;
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
