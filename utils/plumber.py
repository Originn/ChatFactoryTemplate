
import pdfplumber
import re
import sys
import json


# def extract_headers(pdf):
#     headers = []

#     for page in pdf.pages:
#         words = []
#         current_word = ""
#         prev_char = None

#         for char in sorted(page.chars, key=lambda x: (-x['top'], x['x0'])):  # Sort by top first, then by left
#             if "Bold" in char["fontname"] and 23 <= char["size"] <= 27:  # Broadened size range
#                 # If there's a significant horizontal gap or it's a space, it's a new word
#                 if prev_char and (char["x0"] - prev_char["x1"] > 15 or char["text"] == " "):  # Increased gap threshold
#                     if current_word:
#                         words.append(current_word)
#                         current_word = ""
#                 current_word += char["text"]
#                 prev_char = char

#         # Append the last word if it exists
#         if current_word:
#             words.append(current_word)

#         header = ' '.join(words).strip()
#         # Remove any duplicate spaces
#         header = re.sub(' +', ' ', header)
#         if header:
#             headers.append(f"Page {page.page_number}: {header}")

#     # Filtering repeated headers
#     filtered_headers = list(dict.fromkeys(headers))

#     return filtered_headers

# # Usage example:
# with pdfplumber.open("C:\\Users\\ori_s\\Downloads\\SolidCAM related\\SolidCAM_docs\\scwire.pdf") as pdf:
#     headers_list = extract_headers(pdf)
#     for header in headers_list:
#         print(header)

# import pdfplumber

# def extract_home_sections(pdf_path):
#     def remove_space_after_arrow(header):
#         while True:
#             prev_header = header
#             header = remove_single_instance(header)
#             if prev_header == header:  # No more replacements needed
#                 break
#         return header

#     def remove_single_instance(s):
#         i = 0
#         output = []
#         while i < len(s):
#             char = s[i]
#             if char == ">":
#                 output.append(char)
#                 i += 1
#                 # Skip spaces after '>'
#                 while i < len(s) and s[i] == " ":
#                     i += 1
#                 # If we encounter a non-space character, we'll keep it
#                 # and also skip the next space (if it exists)
#                 if i < len(s) and s[i] != " ":
#                     output.append(s[i])
#                     i += 1
#                     # If the next character is a space, skip it
#                     if i < len(s) and s[i] == " ":
#                         i += 1
#             else:
#                 output.append(char)
#                 i += 1
#         return ''.join(output)

#     sections = []
#     with pdfplumber.open(pdf_path) as pdf:
#         current_header = None
#         current_PageContent = []
#         for page in pdf.pages:
#             text = page.extract_text()
#             if not text:
#                 continue
#             lines = text.split('\n')
#             i = 0
#             while i < len(lines):
#                 line = lines[i]
#                 if line.startswith("Home"):
#                     if current_header:
#                         sections.append({
#                             'header': current_header,
#                             'PageContent': "\n".join(current_PageContent)
#                         })
#                         current_PageContent = []
#                     current_header = line
#                     while not current_header.endswith(">") and (i+1) < len(lines):
#                         i += 1
#                         current_header += " " + lines[i]
#                 else:
#                     if current_header:
#                         current_PageContent.append(line)
#                 i += 1
                        
#         # Capture the last section if needed
#         if current_header and current_PageContent:
#             sections.append({
#                 'header': current_header,
#                 'PageContent': "\n".join(current_PageContent)
#             })

#     # Post-process headers to remove the space after '>'
#     for section in sections:
#         section["header"] = remove_space_after_arrow(section["header"])

#     # Further post-process to remove sections with headers that are just "Home" or contains only "Home" followed by a description
#     sections = [section for section in sections if not (section["header"] == "Home" or section["header"].startswith("Home ") and ">" not in section["header"])]
                
#     return sections

# # Usage:
# pdf_path = "C:\\Users\\ori_s\\Downloads\\SolidCAM related\\SolidCAM_docs\\scturn.pdf"
# home_sections = extract_home_sections(pdf_path)
# for section in home_sections:
#     print("Header:", section["header"])
#     #print("PageContent:\n", section["PageContent"])
#     #print("="*80)  # line separator for clarity
#     #input()



def clean_text(text):
    index_last_checked = 0
    while True:
        index_gt = text.find('>', index_last_checked)
        if index_gt == -1:
            break  # No more '>' found, exit loop
        
        # Find the next space after '>'
        index_space = text.find(' ', index_gt)
        if index_space == -1:
            break  # No more spaces found after the last '>', exit loop
        
        # Delete the space
        text = text[:index_space] + text[index_space+1:]
        
        # Update the index_last_checked to the position after the current '>'
        index_last_checked = index_gt + 1
    
    return text

def combine_multiline_header(header):
    # Split the header by newline to get individual lines
    lines = header.split('\n')
    
    combined = []
    buffer = ""
    for line in lines:
        # If buffer has PageContent and current line doesn't start with 'Home'
        if buffer and not line.startswith("Home"):
            buffer += " " + line.strip()  # .strip() to remove any leading/trailing whitespace
        else:
            if buffer:
                combined.append(buffer)
                buffer = ""
            buffer = line.strip()
    # Add any remaining PageContent in the buffer
    if buffer:
        combined.append(buffer)
    
    # Combine the processed lines back into a single string and replace '>' with '| '
    return '\n'.join(combined).replace('>', '| ')


def is_bold(char):
    return "Bold" in char.get("fontname", "")

def wrap_large_bold_sentences(text, chars):
    bold_sentences = []
    temp_sentence = ''
    inside_bold_sentence = False
    prev_y0 = chars[0]["y0"] if chars else None

    for idx, char in enumerate(chars):
        if inside_bold_sentence and abs(char["y0"] - prev_y0) > 10:
            temp_sentence += '\n'
        if is_bold(char) and char["size"] > 24:
            inside_bold_sentence = True
            temp_sentence += char["text"]
        else:
            if inside_bold_sentence:
                # Check if the bold sentence is standalone (either followed by a newline or it's the end of the text)
                if char["text"] == '\n':
                    # If next character is also bold and has a large font size, continue appending
                    if idx+1 < len(chars) and is_bold(chars[idx+1]) and chars[idx+1]["size"] > 24:
                        continue
                    else:
                        bold_sentences.append(temp_sentence)
                        temp_sentence = ''
                        inside_bold_sentence = False
                else:
                    break
        prev_y0 = char["y0"]

    # If there's a remaining bold sentence, add it
    if temp_sentence:
        bold_sentences.append(temp_sentence)

    # Wrap bold sentences with ^^ 
    for sentence in bold_sentences:
        # Skip sentences that start with *
        if text.startswith('*'):
            continue

        add_newline = False
        # Check if sentence ends with a newline
        if sentence.endswith('\n'):
            sentence = sentence.rstrip('\n')
            add_newline = True

        text = text.replace(sentence, f"**{sentence}**", 1)  # Only replace the first occurrence

        if add_newline:
            # Add back the newline after the ^^
            text = text.replace(f"^^{sentence}^^", f"^^{sentence}^^\n", 1)

    return text








def wrap_bold_text(text, chars):
    # Extract bold text segments
    bold_text_segments = []
    inside_bold_segment = False
    temp_bold_string = ''
    prev_doctop = None
    prev_char_was_bold = False

    for char in chars:
        # Check for new line based on doctop value
        new_line_detected = prev_doctop and abs(char["doctop"] - prev_doctop) > 10

        if is_bold(char):
            if not inside_bold_segment:  # Beginning of bold segment
                inside_bold_segment = True
            temp_bold_string += char["text"]
        else:
            if inside_bold_segment:  # End of bold segment
                bold_text_segments.append((temp_bold_string, prev_char_was_bold))
                temp_bold_string = ''
                inside_bold_segment = False

        prev_doctop = char["doctop"]
        prev_char_was_bold = is_bold(char)

    # If there's a remaining bold segment, add it
    if temp_bold_string:
        bold_text_segments.append((temp_bold_string, prev_char_was_bold))

    # Wrap bold segments with ** if the segment is alone on a line or if it's at the start of a line
    for segment, prev_was_bold in bold_text_segments:
        if segment != "Related Topics":
            if ('\n' + segment + '\n') in text or text.startswith(segment + '\n') or text.endswith('\n' + segment) or (not prev_was_bold and segment in text.split('\n')[0]):
                text = text.replace(segment, f"**{segment}**", 1)  # Only replace the first occurrence

    return text



def find_pages_starting_with(pdf_path, start_string):
    headers_with_PageContent = []

    with pdfplumber.open(pdf_path) as pdf:
        last_header = None
        last_header_page_number = None
        PageContent_accumulator = []
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()

            if text and text.startswith(start_string):
                # If we had previously found a header, save its associated PageContent
                if last_header:
                    headers_with_PageContent.append({
                        'page_number': last_header_page_number + 1,  # +1 to make it 1-indexed
                        'header': last_header,
                        'PageContent': PageContent_accumulator
                    })
                    PageContent_accumulator = []  # Reset the accumulator for the next header
                last_header = clean_text(text)
                last_header_page_number = i
            else:
                # Accumulate PageContent
                chars = page.chars
                wrapped_text = wrap_bold_text(text, chars)
                wrapped_text = wrap_large_bold_sentences(wrapped_text, chars)
                PageContent_accumulator.append((i, wrapped_text))

        # If there's a last header without PageContent, add it too (though its PageContent will be empty)
        if last_header:
            headers_with_PageContent.append({
                'page_number': last_header_page_number + 1,  # +1 to make it 1-indexed
                'header': last_header,
                'PageContent': PageContent_accumulator
            })

    return headers_with_PageContent


#Removing Ralted Topics with hooks and link, avoiding removal of edge cases.


def has_special_character_in_last_three_lines(lines, current_index):
    """Check if there's a special character in the concatenated last three lines."""
    concatenated = ''.join(lines[current_index-3:current_index])
    
    # Check for a dash between uppercase letters
    if re.search(r'[A-Z]-[A-Z]', concatenated):
        return False

    # Check if the concatenated string starts with a pattern like "1." or "2."
    if re.match(r'^\d+\.', concatenated):
        return False
    
    special_characters = [':', '°']
    for char in special_characters:
        if char in concatenated:
            return True
            
    return False

def remove_related_topics_sentences(text):
    lines = text.split('\n')
    
    i = 0
    related_topics_count = 0

    while i < len(lines):
        line = lines[i]
        split_line = line.split()

        if "Related Topics" in line:
            related_topics_count += 1
            if related_topics_count > 1:
                related_topics_count = 0  # Reset the count
                i += 1
                continue

            # If the last three lines have a special character when concatenated, set a flag to skip the removal of lines above
            skip_upward = has_special_character_in_last_three_lines(lines, i)

            # Moving upwards and checking for short sentences
            if not skip_upward:
                prev_index = i - 1
                while prev_index >= 0:
                    prev_split_line = lines[prev_index].split()
                    # Check if the line starts with a pattern like "1." or "2."
                    line_starts_with_number_pattern = re.match(r'^\d+\.', ' '.join(prev_split_line))
                    if line_starts_with_number_pattern:
                        break
                    elif not prev_split_line or (len(prev_split_line) <= 8 and not prev_split_line[-1][-1] in ['.', ',', '?', '!', ';', ':', '>', '/']):
                        del lines[prev_index]
                        prev_index -= 1
                        i -= 1  # Adjust current index due to deletion
                    else:
                        break

            # Moving downwards and checking for short sentences, lines ending with underscores, and lines longer than 8 words without special endings
            next_index = i + 1
            while next_index < len(lines):
                next_split_line = lines[next_index].split()
                if '>' in lines[next_index]:  # Break if '>' character is anywhere in the line
                    break
                elif (not next_split_line or len(next_split_line) > 8 or next_split_line[-1].endswith('_') or not next_split_line[-1][-1] in ['.', ',', '?', '!', ';', ':', '/']):
                    del lines[next_index]
                else:
                    break

        i += 1

    # Remove any remaining "Related Topics" occurrences
    while "Related Topics" in lines:
        lines.remove("Related Topics")
    
    return '\n'.join(lines)


def append_related_topics(text):
    lines = text.split('\n')
    special_chars = ['.', ',', '?', '!', ';', ':', '>', '/']
    
    i = len(lines) - 1
    count_lines_without_special_chars = 0

    while i >= 0 and not any(lines[i].endswith(ch) for ch in special_chars):
        count_lines_without_special_chars += 1
        i -= 1

    # If at least two sentences adhere to the rules, append "Related Topics" at the bottom
    if count_lines_without_special_chars >= 2:
        lines.append("Related Topics")

    return '\n'.join(lines)


# Usage:
##pdf_path = "C:\\Users\\ori_s\\Downloads\\SolidCAM related\\SolidCAM_docs\\scturn.pdf"


# Extracting text from the PDF:
# all_text = ""
# with pdfplumber.open('C:\\Users\\ori_s\\Downloads\\SolidCAM related\\SolidCAM_docs\\scturn.pdf') as pdf:
#     for i in range(925, 926):  # Pages 1 through 13
#         page = pdf.pages[i]
#         extracted_text = page.extract_text()
#         all_text += extracted_text + "\n"
        
# cleaned_text = remove_related_topics_sentences(all_text)
# print(cleaned_text)






# import pdfplumber

# # File path to your PDF
# pdf_path = 'C:\\Users\\ori_s\\Downloads\\SolidCAM related\\SolidCAM_docs\\scturn.pdf'

# # Open the PDF
# with pdfplumber.open(pdf_path) as pdf:
#     # Extract text from page 2190 (0-indexed, so it's 2189 in the code)
#     page = pdf.pages[25]
#     text = page.find_table()

#     # Print the extracted text
#     print(text)


##Extracting tables
# import pdfplumber

# def merge_tables_across_pages(pdf, start_page_idx):
#     merged_table = pdf.pages[start_page_idx].extract_table()
#     current_page_idx = start_page_idx
    
#     # Check if the last row has an empty cell just before the last cell with text
#     def is_incomplete_last_row(row):
#         return row[-2] == '' and row[-1]

#     # Extract the first cell from a list of words based on x-coordinates
#     def extract_first_cell(words):
#         # Sort words by x0 and then by y0
#         sorted_words = sorted(words, key=lambda x: (x["x0"], x["top"]))
        
#         # Tolerance for grouping words as being on the same line
#         y_tolerance = 5

#         lines = []
#         current_line = [sorted_words[0]["text"]]

#         for i in range(1, len(sorted_words)):
#             # If the y difference is within the tolerance, it's the same line
#             if abs(sorted_words[i]["top"] - sorted_words[i-1]["top"]) <= y_tolerance:
#                 current_line.append(sorted_words[i]["text"])
#             else:
#                 lines.append(' '.join(current_line))
#                 current_line = [sorted_words[i]["text"]]

#         # Add the last line
#         if current_line:
#             lines.append(' '.join(current_line))

#         # For now, just return the first line (which should be the first cell)
#         return lines[0] if lines else ''


#     # Keep merging until we reach a complete table or end of the PDF
#     while (not merged_table[-1][-1] or is_incomplete_last_row(merged_table[-1])) and current_page_idx < len(pdf.pages) - 1:
#         current_page_idx += 1
#         next_table = pdf.pages[current_page_idx].extract_table()
        
#         if is_incomplete_last_row(merged_table[-1]) and not next_table:
#             # If there's no detected table on the next page, extract words instead
#             words = pdf.pages[current_page_idx].extract_words()
#             first_cell = extract_first_cell(words)
#             second_cell = pdf.pages[current_page_idx].extract_text().replace(first_cell, '', 1).strip()
            
#             # Append the text to the last two cells of the previous row in merged_table
#             merged_table[-1][-2] += " " + first_cell
#             merged_table[-1][-1] += " " + second_cell
#             break
        
#         # If next_table is None, then skip to the next iteration
#         if not next_table:
#             continue
        
#         # Merge the last row of the merged table with the first row of the next table at the cell level
#         merged_row = [a + b if a and b else a or b for a, b in zip(merged_table.pop(), next_table[0])]
#         merged_table.append(merged_row)
        
#         # Add the remaining rows from the next table to the merged table
#         merged_table.extend(next_table[1:])

#     return merged_table

# pdf_path = 'C:\\Users\\ori_s\\Downloads\\SolidCAM related\\SolidCAM_docs\\scturn.pdf'
# with pdfplumber.open(pdf_path) as pdf:
#     table = merge_tables_across_pages(pdf, 20)
#     print(table)



##Check words fonts and size
# import pdfplumber

# def wrap_word(word, font, size):
#     return f"**{word}** (Font: {font}, Size: {size})"

# # File path to your PDF
# pdf_path = 'C:\\Users\\ori_s\\Downloads\\SolidCAM related\\SolidCAM_docs\\scturn.pdf'

# # Open the PDF
# with pdfplumber.open(pdf_path) as pdf:
#     # Extract text from page 11 (0-indexed, so it's 10 in the code)
#     page = pdf.pages[10]
#     chars = page.chars  # Get character details
    
#     current_word = ""
#     current_font = None
#     current_size = None
#     wrapped_text = ""
    
#     for char in chars:
#         if char['text'].isspace() or (current_font and current_font != char['fontname']) or (current_size and current_size != char['size']):
#             if current_word:
#                 wrapped_text += wrap_word(current_word, current_font, current_size) + " "
#                 current_word = ""
#         current_word += char['text']
#         current_font = char['fontname']
#         current_size = char['size']
        
#     # Add the last word if any
#     if current_word:
#         wrapped_text += wrap_word(current_word, current_font, current_size)

#     print(wrapped_text)

if __name__ == "__main__":
    pdf_path = sys.argv[1]  # Get the PDF path from the command line argument
    pages_with_home = find_pages_starting_with(pdf_path, "Home >")

    grouped_results = {}

    for page_info in pages_with_home:
        # Clean the header PageContent
        header = combine_multiline_header(page_info['header'])
        
        if header not in grouped_results:
            grouped_results[header] = []

        for (page_number, PageContent_text) in page_info['PageContent']:
            # Append "Related Topics" where necessary
            PageContent_text = append_related_topics(PageContent_text)
            # Clean the PageContent using the remove_related_topics_sentences function
            PageContent_text = remove_related_topics_sentences(PageContent_text)
            
            # Store the cleaned PageContent with its page number
            content_data = {
                "page_number": page_number,
                "PageContent": PageContent_text
            }
            grouped_results[header].append(content_data)

    # Convert the dictionary to a list format
    results = [{"header": key, "contents": value} for key, value in grouped_results.items()]
    sys.stdout.write(json.dumps(results))




