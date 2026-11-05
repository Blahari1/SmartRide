import { createContext, useContext } from "react";

export const LocationShareContext = createContext(null);
export const useLocationShare = () => useContext(LocationShareContext);
