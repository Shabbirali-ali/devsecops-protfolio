"use client";
// @flow strict

import { useRef, useState, useEffect } from "react";
import { skillsData } from "@/utils/data/skills";
import { skillsImage } from "@/utils/skill-image";
import Image from "next/image";

function Skills() {
  const scrollerRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  // --- Auto-scroll effect ---
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    let scrollSpeed = 0.7; // control auto-scroll speed
    let req;

    const autoScroll = () => {
      if (!isHovered && !isDragging) {
        el.scrollLeft += scrollSpeed;
        if (el.scrollLeft >= el.scrollWidth - el.clientWidth) {
          el.scrollLeft = 0; // loop back
        }
      }
      req = requestAnimationFrame(autoScroll);
    };

    req = requestAnimationFrame(autoScroll);
    return () => cancelAnimationFrame(req);
  }, [isHovered, isDragging]);

  // --- Drag scroll logic ---
  const onMouseDown = (e) => {
    const el = scrollerRef.current;
    isDownRef.current = true;
    setIsDragging(false);
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
    el.classList.add("cursor-grabbing");
  };

  const onMouseMove = (e) => {
    if (!isDownRef.current) return;
    const el = scrollerRef.current;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1;
    if (Math.abs(walk) > 5) setIsDragging(true);
    el.scrollLeft = scrollLeftRef.current - walk;
  };

  const onMouseUpOrLeave = () => {
    const el = scrollerRef.current;
    isDownRef.current = false;
    el.classList.remove("cursor-grabbing");
    setTimeout(() => setIsDragging(false), 50);
  };

  const onTouchStart = (e) => {
    const el = scrollerRef.current;
    isDownRef.current = true;
    startXRef.current = e.touches[0].pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
  };

  const onTouchMove = (e) => {
    if (!isDownRef.current) return;
    const el = scrollerRef.current;
    const x = e.touches[0].pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1;
    el.scrollLeft = scrollLeftRef.current - walk;
    setIsDragging(true);
  };

  const onTouchEnd = () => {
    isDownRef.current = false;
    setTimeout(() => setIsDragging(false), 50);
  };

  return (
    <div
      id="skills"
      className="relative z-50 border-t my-12 lg:my-24 border-[#25213b]"
    >
      <div className="w-[100px] h-[100px] bg-violet-100 rounded-full absolute top-6 left-[42%] translate-x-1/2 filter blur-3xl opacity-20"></div>

      <div className="flex justify-center -translate-y-[1px]">
        <div className="w-3/4">
          <div className="h-[1px] bg-gradient-to-r from-transparent via-violet-500 to-transparent w-full" />
        </div>
      </div>

      <div className="flex justify-center my-5 lg:py-8">
        <div className="flex items-center">
          <span className="w-24 h-[2px] bg-[#1a1443]"></span>
          <span className="bg-[#1a1443] w-fit text-white p-2 px-5 text-xl rounded-md">
            Skills
          </span>
          <span className="w-24 h-[2px] bg-[#1a1443]"></span>
        </div>
      </div>

      <div className="w-full my-12">
        <div
          ref={scrollerRef}
          className="overflow-x-auto whitespace-nowrap py-2 px-4 no-scrollbar select-none cursor-grab"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUpOrLeave}
          onMouseLeave={onMouseUpOrLeave}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {skillsData.map((skill, id) => (
            <div
              key={id}
              className="inline-block w-36 min-w-fit h-fit flex flex-col items-center justify-center transition-all duration-500 m-3 sm:m-5 rounded-lg group relative hover:scale-[1.15] cursor-pointer"
            >
              <div className="h-full w-full rounded-lg border border-[#1f223c] bg-[#11152c] shadow-none shadow-gray-50 group-hover:border-violet-500 transition-all duration-500">
                <div className="flex -translate-y-[1px] justify-center">
                  <div className="w-3/4">
                    <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center gap-3 p-6">
                  <div className="h-8 sm:h-10">
                    <Image
                      src={skillsImage(skill)?.src}
                      alt={skill}
                      width={40}
                      height={40}
                      className="h-full w-auto rounded-lg"
                    />
                  </div>
                  <p className="text-white text-sm sm:text-lg">{skill}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Skills;
