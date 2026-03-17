import React, { useState, useEffect } from 'react';
import { theme } from '../theme';

interface AutopilotDemoProps {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  concepts?: string[];
}

interface DemoTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'complete';
  concepts: string[];
}

export const AutopilotDemo: React.FC<AutopilotDemoProps> = ({
  isActive,
  currentStep,
  totalSteps,
  concepts = []
}) => {
  const [demoTasks, setDemoTasks] = useState<DemoTask[]>([
    {
      id: 'analyze',
      title: 'Analyze Codebase Structure',
      description: 'Examine project architecture and identify key components',
      status: 'pending',
      concepts: ['codebase-analysis', 'architecture-understanding', 'component-mapping']
    },
    {
      id: 'design',
      title: 'Design Integration Strategy',
      description: 'Plan how to integrate concept tracking with existing systems',
      status: 'pending',
      concepts: ['integration-strategy', 'system-design', 'concept-tracking']
    },
    {
      id: 'implement',
      title: 'Create Prototype Implementation',
      description: 'Build working prototype of concept-cache autopilot system',
      status: 'pending',
      concepts: ['prototype-development', 'cache-implementation', 'autopilot-integration']
    },
    {
      id: 'demonstrate',
      title: 'Run Live Demonstration',
      description: 'Execute multi-step task showing concept evolution in real-time',
      status: 'pending',
      concepts: ['live-demo', 'concept-evolution', 'real-time-tracking']
    }
  ]);

  // Update task status based on current step
  useEffect(() => {
    if (!isActive) return;

    setDemoTasks(prevTasks => 
      prevTasks.map((task, index) => ({
        ...task,
        status: index < (totalSteps - currentStep + 1) ? 'complete' :
                index === (totalSteps - currentStep + 1) ? 'active' : 'pending'
      }))
    );
  }, [isActive, currentStep, totalSteps]);

  const getStepIcon = (status: DemoTask['status']) => {
    switch (status) {
      case 'complete': return '✅';
      case 'active': return '🔄';
      case 'pending': return '⏳';
    }
  };

  const getProgressPercentage = () => {
    if (!isActive) return 0;
    return Math.round(((totalSteps - currentStep) / totalSteps) * 100);
  };

  return (
    <div style={{
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.secondary}`,
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <h3 style={{
          margin: 0,
          color: theme.colors.text.primary,
          fontSize: '16px',
          fontWeight: 600
        }}>
          🧠 Autopilot Concept Evolution Demo
        </h3>
        {isActive && (
          <div style={{
            background: theme.colors.accent.primary,
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600
          }}>
            Step {totalSteps - currentStep + 1}/{totalSteps} ({getProgressPercentage()}%)
          </div>
        )}
      </div>

      {/* Current Concepts Display */}
      {concepts.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontSize: '12px',
            color: theme.colors.text.secondary,
            marginBottom: '8px',
            fontWeight: 600
          }}>
            🎯 Current Attention Focus:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {concepts.map((concept, index) => (
              <span
                key={index}
                style={{
                  background: theme.colors.accent.secondary,
                  color: theme.colors.text.primary,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 500
                }}
              >
                {concept}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Task Progress */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {demoTasks.map((task, index) => (
          <div
            key={task.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '8px',
              background: task.status === 'active' 
                ? theme.colors.accent.secondary + '20'
                : 'transparent',
              borderRadius: '4px',
              border: task.status === 'active' 
                ? `1px solid ${theme.colors.accent.primary}50`
                : '1px solid transparent'
            }}
          >
            <span style={{ fontSize: '16px', marginTop: '2px' }}>
              {getStepIcon(task.status)}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: 600,
                color: theme.colors.text.primary,
                fontSize: '13px',
                marginBottom: '2px'
              }}>
                {task.title}
              </div>
              <div style={{
                color: theme.colors.text.secondary,
                fontSize: '11px',
                marginBottom: '4px'
              }}>
                {task.description}
              </div>
              {task.status === 'active' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {task.concepts.map((concept, i) => (
                    <span
                      key={i}
                      style={{
                        background: theme.colors.background.primary,
                        color: theme.colors.text.tertiary,
                        padding: '1px 6px',
                        borderRadius: '8px',
                        fontSize: '10px'
                      }}
                    >
                      {concept}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {!isActive && (
        <div style={{
          textAlign: 'center',
          padding: '16px',
          color: theme.colors.text.secondary,
          fontSize: '12px',
          fontStyle: 'italic'
        }}>
          💡 Start autopilot mode to see concept evolution tracking in action
        </div>
      )}
    </div>
  );
};

export default AutopilotDemo;