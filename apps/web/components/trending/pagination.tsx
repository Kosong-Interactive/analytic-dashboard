import { Pager } from "@/components/releases/pagination";
import type { TrendingList } from "@/lib/trending/list";
import { trendingHref, type TrendingQuery } from "@/lib/trending/query";

export function Pagination({ list, query }: { list: TrendingList; query: TrendingQuery }) {
  return (
    <Pager
      page={list.page}
      pageCount={list.pageCount}
      pageSize={list.pageSize}
      total={list.total}
      hrefFor={(page) => trendingHref(query, { page })}
    />
  );
}
