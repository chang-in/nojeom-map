import MapView from "./MapView";

// Server Component. 지도는 브라우저 API(window·geolocation)에 의존하므로
// 클라이언트 경계인 MapView가 맡는다.
export default function Home() {
  return <MapView />;
}
