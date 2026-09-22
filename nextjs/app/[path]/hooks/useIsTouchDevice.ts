import { useEffect, useState } from "react";

export function useIsTouchDevice(): boolean {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse), (hover: none), (max-width: 768px)");
    const update = () => setIsTouchDevice(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isTouchDevice;
}
