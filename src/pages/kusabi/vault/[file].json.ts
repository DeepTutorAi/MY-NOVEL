import type { APIRoute, GetStaticPaths } from "astro";
import { buildVaultFiles } from "../../../data/kusabi/vault";

export const getStaticPaths: GetStaticPaths = async () => {
  const files = await buildVaultFiles();
  return Object.entries(files).map(([file, data]) => ({ params: { file }, props: { data } }));
};

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.data), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
