import { useCallback } from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

interface AuthState {
user: AuthUser | null;
isLoading: boolean;
isAuthenticated: boolean;
login: () => void;
logout: () => void;
}

export function useAuth(): AuthState {
const user: AuthUser = {
id: "guest-user",
email: "[guest@move.app](mailto:guest@move.app)",
firstName: "Guest",
lastName: "User",
profileImageUrl: null,
};

const login = useCallback(() => {
console.log("Guest mode");
}, []);

const logout = useCallback(() => {
console.log("Guest mode");
}, []);

return {
user,
isLoading: false,
isAuthenticated: true,
login,
logout,
};
}
