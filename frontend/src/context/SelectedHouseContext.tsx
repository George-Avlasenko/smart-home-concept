import React, { createContext, useContext, useState, useCallback } from 'react';

type SelectedHouseContextType = {
  selectedHouseId: number | null;
  setSelectedHouseId: (id: number | null) => void;
};

const SelectedHouseContext = createContext<SelectedHouseContextType | null>(null);

export const SelectedHouseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedHouseId, setSelectedHouseIdState] = useState<number | null>(null);
  const setSelectedHouseId = useCallback((id: number | null) => {
    setSelectedHouseIdState(id);
  }, []);
  return (
    <SelectedHouseContext.Provider value={{ selectedHouseId, setSelectedHouseId }}>
      {children}
    </SelectedHouseContext.Provider>
  );
};

export const useSelectedHouse = () => {
  const ctx = useContext(SelectedHouseContext);
  if (!ctx) throw new Error('useSelectedHouse must be used within SelectedHouseProvider');
  return ctx;
};
