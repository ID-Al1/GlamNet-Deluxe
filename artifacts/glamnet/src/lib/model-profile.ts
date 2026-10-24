import { useQueryClient } from "@tanstack/react-query";
import { useGetMyModelProfile, getGetMyModelProfileQueryKey } from "@workspace/api-client-react";
import type { ModelProfileOwner } from "@workspace/api-client-react";

/** The signed-in model's own profile, plus a setter so mutations can write their response straight into the cache. */
export function useModelProfile() {
  const qc = useQueryClient();
  const query = useGetMyModelProfile();
  const setProfile = (p: ModelProfileOwner) => qc.setQueryData(getGetMyModelProfileQueryKey(), p);
  return { ...query, profile: query.data, setProfile };
}
