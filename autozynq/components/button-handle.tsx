import React from "react";
import { Handle, HandleProps } from "reactflow";

export function ButtonHandle({
  children,
  showButton = true,
  ...props
}: HandleProps & {
  children?: React.ReactNode;
  showButton?: boolean;
}) {
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <Handle {...props} />
      {showButton && children && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 10,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
