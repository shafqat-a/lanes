/* Build-time enumeration of the repository's pinned Unicode tables.
 * No input JavaScript or runtime guest values are executed by this program. */
#include <stdio.h>
#include "cutils.h"
#include "libunicode.h"
int main(void) {
 printf("{\"version\":\"%d.%d.%d\",\"maps\":[",LIBUNICODE_UNICODE_VERSION_MAJOR,LIBUNICODE_UNICODE_VERSION_MINOR,LIBUNICODE_UNICODE_VERSION_PATCH);
 for(int mode=0;mode<2;mode++) {
  if(mode)printf(",");printf("[");int first=1;
  for(uint32_t c=0;c<=0x10ffff;c++) {
   uint32_t out[LRE_CC_RES_LEN_MAX];int n=lre_case_conv(out,c,mode);
   if(n==1&&out[0]==c)continue;
   if(!first)printf(",");first=0;printf("[%u",c);
   for(int j=0;j<n;j++)printf(",%u",out[j]);printf("]");
  }
  printf("]");
 }
 printf("],\"flags\":[");int first=1;uint32_t start=0;int previous=0;
 for(uint32_t c=0;c<=0x110000;c++) {
  int flags=c==0x110000?0:((lre_is_cased(c)?1:0)|(lre_is_case_ignorable(c)?2:0));
  if(flags!=previous){if(previous){if(!first)printf(",");first=0;printf("[%u,%u,%d]",start,c-1,previous);}start=c;previous=flags;}
 }
 puts("]}");return 0;
}
