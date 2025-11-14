import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { CommonModule } from "@angular/common";
import { SafePipe } from "../../safepipe";

interface TextNode {
  type: "text";
  text: string;
  format: number;
}

interface ElementNode {
  type: "paragraph" | "root" | "heading" | string;
  children: EditorNode[];
  [key: string]: any;
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

  // Renderer Registry
  private readonly nodeRenderers: { [key: string]: (node: any) => string } = {
    root: (node) => this.serializeChildren(node),
    paragraph: (node) => `<p>${this.serializeChildren(node)}</p>`,
    text: (node) => this.renderTextNode(node),
    heading: (node) =>
      `<h${node.tag.substring(1)}>${this.serializeChildren(node)}</h${node.tag.substring(1)}>`,
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

    // Fallback for unknown element nodes: just render their children.
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
    // Lexical format bitmask: 1=bold, 2=italic, 8=underline
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
