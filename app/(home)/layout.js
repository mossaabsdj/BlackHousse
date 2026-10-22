import Header from "../component/navbar/page";
import Footer from "../component/Home/Footer/page";
export default function RootLayout({ children }) {
  return (

    <><Header /> <main>{children} </main><Footer /></>
    
      
    
  );
}
