"use client";

import { useEffect, useRef } from "react";
import { messages } from "@/lib/messages";

type Align = "left" | "center";

export function TextHtmlEditor({
  html,
  align,
  onChange,
}: {
  html: string;
  align: Align;
  onChange: (next: { html: string; align: Align }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html || "<p></p>";
    // 마운트 시에만 초기 HTML 을 넣는다. 입력마다 다시 넣으면 커서가 튄다.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 초기값만
  }, []);

  function emit(nextAlign = align) {
    onChange({ html: ref.current?.innerHTML ?? "", align: nextAlign });
  }

  function run(command: string, value?: string) {
    document.execCommand(command, false, value);
    emit();
  }

  function setAlign(next: Align) {
    run(next === "center" ? "justifyCenter" : "justifyLeft");
    emit(next);
  }

  function addLink() {
    const url = window.prompt(messages.linkUrlPrompt);
    if (!url) return;
    run("createLink", url);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        <ToolbarButton onClick={() => run("bold")}>{messages.formatBold}</ToolbarButton>
        <ToolbarButton onClick={() => run("italic")}>{messages.formatItalic}</ToolbarButton>
        <ToolbarButton onClick={() => run("underline")}>{messages.formatUnderline}</ToolbarButton>
        <ToolbarButton onClick={() => run("insertUnorderedList")}>
          {messages.formatList}
        </ToolbarButton>
        <ToolbarButton onClick={addLink}>{messages.formatLink}</ToolbarButton>
        <ToolbarButton onClick={() => setAlign("left")}>{messages.alignLeft}</ToolbarButton>
        <ToolbarButton onClick={() => setAlign("center")}>{messages.alignCenter}</ToolbarButton>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="min-h-28 rounded border px-2 py-1 text-sm"
        style={{ textAlign: align }}
        onInput={() => emit()}
      />
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="ghost-btn-sm"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
