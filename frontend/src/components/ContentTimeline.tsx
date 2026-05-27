// Content Timeline Component - Visualizes content workflow progress.

interface TimelineStep {
  name: string;
  status: string;
  icon: string;
  description: string;
  is_completed: boolean;
  is_current: boolean;
  timestamp: string | null;
  formatted_time: string;
}

interface ContentTimelineProps {
  timeline: TimelineStep[];
  current_status: string;
}

export default function ContentTimeline({ timeline, current_status }: ContentTimelineProps) {
  if (!timeline || timeline.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
        Content Lifecycle
      </h3>
      
      <div className="relative">
        {/* Vertical line */}
        <div 
          className="absolute left-6 top-0 bottom-0 w-0.5"
          style={{ backgroundColor: "var(--border-color)" }}
        />
        
        {/* Timeline steps */}
        <div className="space-y-6">
          {timeline.map((step, index) => (
            <div key={step.status} className="relative flex items-start">
              {/* Icon */}
              <div
                className={`
                  relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all
                  ${step.is_completed 
                    ? "bg-green-500 border-green-500 text-white" 
                    : step.is_current 
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-lg" 
                      : "bg-transparent border-gray-300 text-gray-400"
                  }
                `}
              >
                <span className="material-symbols-outlined text-xl">
                  {step.is_completed ? "check_circle" : step.icon}
                </span>
                
                {/* Pulsing animation for current step */}
                {step.is_current && !step.is_completed && (
                  <>
                    <span className="absolute inset-0 rounded-full animate-ping bg-indigo-400 opacity-75" />
                    <span className="absolute inset-0 rounded-full animate-pulse bg-indigo-600 opacity-50" />
                  </>
                )}
              </div>
              
              {/* Content */}
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <h4
                    className={`
                      font-semibold text-base
                      ${step.is_completed 
                        ? "text-green-700" 
                        : step.is_current 
                          ? "text-indigo-600" 
                          : "text-gray-400"
                      }
                    `}
                    style={{ 
                      color: step.is_completed 
                        ? "var(--color-success)" 
                        : step.is_current 
                          ? "var(--color-primary)" 
                          : "var(--text-secondary)"
                    }}
                  >
                    {step.name}
                  </h4>
                  
                  {step.timestamp && (
                    <span
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{ 
                        backgroundColor: step.is_completed 
                          ? "rgba(34, 197, 94, 0.1)" 
                          : step.is_current 
                            ? "rgba(99, 102, 241, 0.1)" 
                            : "var(--bg-secondary)",
                        color: step.is_completed 
                          ? "var(--color-success)" 
                          : step.is_current 
                            ? "var(--color-primary)" 
                            : "var(--text-secondary)"
                      }}
                    >
                      {step.formatted_time}
                    </span>
                  )}
                </div>
                
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {step.description}
                </p>
                
                {/* Status-specific additional info */}
                {step.status === "pending_approval" && step.is_current && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-green-500 text-base">
                      whatsapp
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>
                      Waiting for WhatsApp approval
                    </span>
                  </div>
                )}
                
                {step.status === "scheduled" && step.is_current && (
                  <div className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    Will be published automatically at scheduled time
                  </div>
                )}
                
                {step.status === "analytics" && step.is_current && (
                  <div className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    Analytics will be collected 24 hours after publishing
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Summary */}
      <div 
        className="mt-6 p-4 rounded-lg"
        style={{ 
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-color)"
        }}
      >
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: "var(--text-secondary)" }}>Current Status:</span>
          <span 
            className="font-semibold capitalize px-3 py-1 rounded-full"
            style={{ 
              backgroundColor: current_status === "published" 
                ? "rgba(34, 197, 94, 0.1)" 
                : current_status === "pending_approval"
                  ? "rgba(245, 158, 11, 0.1)"
                  : "var(--bg-tertiary)",
              color: current_status === "published" 
                ? "var(--color-success)" 
                : current_status === "pending_approval"
                  ? "var(--color-warning)"
                  : "var(--color-primary)"
            }}
          >
            {current_status.replace("_", " ")}
          </span>
        </div>
      </div>
    </div>
  );
}
