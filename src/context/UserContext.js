'use client';
import { createContext, useContext, useState } from 'react';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [userName, setUserName] = useState(null);
  return <UserContext.Provider value={{ userName, setUserName }}>{children}</UserContext.Provider>;
};

export const useUser = () => useContext(UserContext);
