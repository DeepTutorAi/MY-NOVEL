import type { APIRoute, GetStaticPaths } from "astro";
import { buildVaultFiles } from "../../../data/tsukinomi/vault";

export const getStaticPaths: GetStaticPaths = () =>
  Object.entries(buildVaultFiles()).map(([file, data]) => ({ params: { file }, props: { data } }));

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.data), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
