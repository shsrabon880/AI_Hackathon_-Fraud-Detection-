import React, { useState } from "react";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { api } from "../services/api";

interface ChatMessage {
  role: "assistant" | "user";
  text: string;
}

const QUICK_PROMPTS = [
  "How does FraudShield work?",
  "Explain 3-Tier Risk Thresholds",
  "Guide me through the sidebar",
  "How to connect bKash / Bank?",
  "How to export PDF/CSV statements?",
];

export const FraudShieldAssistant: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Hello! I am FraudShield Assistant. Ask me how our ML + Graph engine works, how the 3-Tier Risk Approval thresholds operate, or how to use any sidebar feature.",
    },
  ]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setSending(true);
    try {
      const res = await api.request<{ reply: string }>("/api/v1/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ message: trimmed }),
      });
      setMessages((prev) => [...prev, { role: "assistant", text: res.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            "Built-in Guide: FraudShield scores every transaction 0–100% using Explainable ML + Graph analysis. " +
            "0–50% auto-approves, 50–79% opens an 'Are you approve or not?' prompt, and 80%+ auto-rejects with an audible alarm and FRAUD ALERT screen.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {open && (
        <div className="mb-3 w-[340px] sm:w-[385px] max-h-[520px] bg-[#0d1322] border border-[#3a2c70] rounded-2xl shadow-[0_14px_45px_rgba(46,34,89,0.55)] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-[#15112b] border-b border-[#29204d] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#2e2259] border border-[#6d4aff]/50 flex items-center justify-center">
                <Bot className="w-4 h-4 text-[#c4b5fd]" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>FraudShield Assistant</span>
                  <Sparkles className="w-3 h-3 text-purple-400" />
                </div>
                <div className="text-[10px] text-[#a78bfa]">AI Platform & Security Guide</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#231b45]"
              aria-label="Close FraudShield Assistant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] px-3 py-2.5 rounded-xl whitespace-pre-line leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#4c3599] text-white"
                      : "bg-[#141a2e] border border-[#243052] text-slate-200"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="text-[11px] text-purple-300 italic">Analyzing platform guide...</div>
            )}
          </div>

          {/* Quick-Action Prompt Chips */}
          <div className="px-3 py-2 border-t border-[#1c2540] bg-[#0a0f1d] flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                className="px-2 py-1 rounded-md bg-[#161c33] hover:bg-[#2e2259] border border-[#2a345c] text-[10.5px] text-purple-200 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="p-2.5 border-t border-[#1c2540] bg-[#080c17] flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask how FraudShield works..."
              className="flex-1 px-3 py-2 rounded-lg bg-[#0d1322] border border-[#243052] text-xs text-white focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="p-2 rounded-lg bg-[#4c3599] hover:bg-[#5e42bd] disabled:opacity-50 text-white"
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Glowing Dark-Purple/Navy Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-[#2e2259] to-[#1b163b] hover:from-[#3d2d75] hover:to-[#271e57] border border-[#7c5cff]/50 text-white shadow-[0_0_24px_rgba(124,92,255,0.45)] transition-all"
        title="Open FraudShield AI Assistant"
      >
        <Bot className="w-5 h-5 text-[#c4b5fd]" />
        <span className="text-xs font-semibold tracking-wide">FraudShield AI</span>
      </button>
    </div>
  );
};
