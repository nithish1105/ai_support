import { AIAnalysis } from '../types';
import { Brain, TrendingUp, AlertTriangle, Target } from 'lucide-react';

interface AIAnalysisPanelProps {
  analysis?: AIAnalysis | null;
  attemptCount?: number;
  className?: string;
}

function SentimentDisplay({ label, score }: { label: string; score: number }) {
  const config = {
    NEGATIVE: { emoji: '😟', color: 'text-orange-600', bg: 'bg-orange-50', label: 'Negative' },
    POSITIVE: { emoji: '😊', color: 'text-green-600', bg: 'bg-green-50', label: 'Positive' },
    NEUTRAL: { emoji: '😐', color: 'text-gray-600', bg: 'bg-gray-50', label: 'Neutral' },
  }[label] || { emoji: '😐', color: 'text-gray-600', bg: 'bg-gray-50', label: label };

  return (
    <div className={`${config.bg} rounded-lg p-3`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sentiment</p>
          <p className={`font-bold text-sm mt-0.5 ${config.color}`}>
            {config.emoji} {config.label}
          </p>
        </div>
        <span className="text-xs text-gray-400">{(score * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

function UrgencyDisplay({ label, score }: { label: string; score: number }) {
  const config = {
    LOW: { color: 'text-green-600', bg: 'bg-green-50', bar: 'bg-green-400' },
    MEDIUM: { color: 'text-orange-500', bg: 'bg-orange-50', bar: 'bg-orange-400' },
    HIGH: { color: 'text-orange-600', bg: 'bg-orange-50', bar: 'bg-orange-500' },
    CRITICAL: { color: 'text-black', bg: 'bg-orange-100', bar: 'bg-black' },
  }[label] || { color: 'text-gray-600', bg: 'bg-gray-50', bar: 'bg-gray-400' };

  return (
    <div className={`${config.bg} rounded-lg p-3`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Urgency</p>
      <div className="flex items-center justify-between mb-1.5">
        <p className={`font-bold text-sm ${config.color}`}>{label}</p>
        <span className="text-xs text-gray-400">{(score * 100).toFixed(0)}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${config.bar}`} style={{ width: `${score * 100}%` }} />
      </div>
    </div>
  );
}

function EscalationDisplay({ level, score }: { level: string; score: number }) {
  const getColor = (score: number) => {
    if (score >= 81) return 'bg-black text-white';
    if (score >= 61) return 'bg-orange-100 text-orange-800';
    if (score >= 31) return 'bg-orange-50 text-orange-600';
    return 'bg-green-50 text-green-700';
  };

  const barColor = score >= 81 ? 'bg-black' : score >= 61 ? 'bg-orange-500' : score >= 31 ? 'bg-orange-300' : 'bg-green-400';

  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Escalation Risk</p>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getColor(score)}`}>{level}</span>
        <span className="text-sm font-bold text-black">{score.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function AIAnalysisPanel({ analysis, attemptCount = 0, className = '' }: AIAnalysisPanelProps) {
  if (!analysis) {
    return (
      <div className={`bg-white border border-gray-100 rounded-xl p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Brain size={16} className="text-orange-500" />
          <h3 className="font-bold text-sm text-black uppercase tracking-wide">AI Analysis</h3>
        </div>
        <div className="text-center py-6">
          <Brain size={32} className="text-gray-200 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Analysis will appear after the first message</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-100 rounded-xl p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 bg-orange-100 rounded flex items-center justify-center">
          <Brain size={13} className="text-orange-600" />
        </div>
        <h3 className="font-bold text-sm text-black uppercase tracking-wide">AI Issue Analysis</h3>
      </div>

      <div className="space-y-3">
        {/* Sentiment */}
        <SentimentDisplay label={analysis.sentiment_label} score={analysis.sentiment_score} />

        {/* Intent */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Intent</p>
              <p className="font-bold text-sm text-black mt-0.5 flex items-center gap-1">
                <Target size={12} className="text-orange-500" />
                {analysis.intent_label}
              </p>
            </div>
            <span className="text-xs text-gray-400">{(analysis.intent_score * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Urgency */}
        <UrgencyDisplay label={analysis.urgency_label} score={analysis.urgency_score} />

        {/* Escalation Risk */}
        <EscalationDisplay level={analysis.escalation_risk_level} score={analysis.escalation_risk_score} />

        {/* AI Attempts */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">AI Attempts</p>
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${
                    i <= attemptCount
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {i}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Key issue */}
        {analysis.key_issue && (
          <div className="bg-orange-50 rounded-lg p-3">
            <p className="text-xs font-medium text-orange-700 uppercase tracking-wide mb-1">Key Issue</p>
            <p className="text-xs text-orange-800 line-clamp-3">{analysis.key_issue}</p>
          </div>
        )}

        {/* Recommended action */}
        {analysis.recommended_action && (
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">Recommended</p>
            <p className="text-xs text-green-800">{analysis.recommended_action}</p>
          </div>
        )}
      </div>
    </div>
  );
}
