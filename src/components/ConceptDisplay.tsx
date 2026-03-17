import React from 'react'

interface ConceptDisplayProps {
  concepts: string[]
  className?: string
}

export function ConceptDisplay({ concepts, className = '' }: ConceptDisplayProps) {
  if (concepts.length === 0) return null

  return (
    <div 
      className={`concept-display ${className}`}
      style={{
        position: 'fixed',
        top: 60, // Below the header
        left: 20,
        right: '50%', // Only take up left half to not overlap context pane
        zIndex: 100,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        padding: '6px 8px',
        background: 'var(--surface2)',
        border: '1px solid var(--border2)',
        borderRadius: 4,
        fontSize: 10,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(4px)',
        backgroundColor: 'var(--surface2)ee', // Semi-transparent
      }}
    >
      <span style={{
        color: 'var(--text2)',
        fontWeight: 600,
        marginRight: 4,
        fontSize: 9,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        🎯 Recent:
      </span>
      {concepts.map((concept, index) => (
        <span
          key={`${concept}-${index}`}
          style={{
            background: 'var(--accent)22',
            color: 'var(--accent)',
            padding: '1px 6px',
            borderRadius: 3,
            border: '1px solid var(--accent)33',
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}
        >
          {concept}
        </span>
      ))}
    </div>
  )
}