import React from 'react';

interface ForkedHyperStyleSheetProps {
  borderColor: string;
}

export function ForkedHyperStyleSheet({ borderColor }: ForkedHyperStyleSheetProps): JSX.Element {
  return (
    <style>
      {`
        .netior-hyper-terms ::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .netior-hyper-terms ::-webkit-scrollbar-thumb {
          border-radius: 10px;
          background: ${borderColor};
        }
        .netior-hyper-terms ::-webkit-scrollbar-thumb:window-inactive {
          background: ${borderColor};
        }
      `}
    </style>
  );
}

