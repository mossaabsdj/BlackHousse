"use client";


import FirstPAge from "@/app/component/Home/FirstPage/page";
import FeedBack from "@/app/component/Home/FeedBack/page";
import { useEffect } from "react";

import MenuImages from "@/app/component/Home/MenuImages/page";
export default function Home() {
  
 

useEffect(() => {
  const id = sessionStorage.getItem("scrollTarget");

  if (id) {
    sessionStorage.removeItem("scrollTarget");

    // Wait until the target element is rendered
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }
}, []);



  return (
  
     
        <>
       


         
            
              <FirstPAge />
              <section id="NotreMenu"  >
                <MenuImages  />
              </section>
              <section id="FeedBack" >
                <FeedBack />
              </section>
             

        </>
    
  );
}
