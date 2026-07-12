'use client'

interface Props {
  answered: number
  right: number
  wrong: number
  rate: number
  onReset: () => void
}

export default function QuizBar({ answered, right, wrong, rate, onReset }: Props) {
  return (
    <div className="quiz-bar shown">
      <div className="stat">
        <span className="num">{answered}</span>
        <span className="label">已答</span>
      </div>
      <div className="stat right">
        <span className="num">{right}</span>
        <span className="label">正确</span>
      </div>
      <div className="stat wrong">
        <span className="num">{wrong}</span>
        <span className="label">错误</span>
      </div>
      <div className="stat">
        <span className="num">{answered > 0 ? `${rate}%` : '—'}</span>
        <span className="label">正确率</span>
      </div>
      <div className="spacer" />
      <button className="icon-btn" onClick={onReset}>重置进度</button>
    </div>
  )
}
