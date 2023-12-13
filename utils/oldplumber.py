
import pdfplumber
import re
import sys
import json

def get_token_count(text):
    tokens = text.split()
    return len(tokens)

def remove_home_header(text):
    header_start = 'Home >'
    # Find the start index of 'Home >'
    start_index = text.find(header_start)
    
    # If 'Home >' is not found, return the original text
    if start_index == -1:
        return text

    # Find the index of the newline character after 'Home >'
    end_index = text.find('\n', start_index)
    
    # If newline is found, remove the header, otherwise return text without 'Home >'
    if end_index != -1:
        # Remove the header by returning the text from after the newline character
        return text[end_index + 1:]
    else:
        # 'Home >' is found but no newline after it, return text without 'Home >'
        return text[start_index + len(header_start):]
    
def extract_header(text, header_start="Home >"):
    # Find the index where "Home >" starts
    start_index = text.find(header_start)
    if start_index != -1:
        # Find the index of the first newline character after "Home >"
        end_index = text.find('\n', start_index)
        # If a newline character is found after "Home >"
        if end_index != -1:
            # Extract the header up to the newline character
            return text[start_index:end_index].strip()
        else:
            # If there's no newline, return the text starting from "Home >"
            return text[start_index:].strip()
    return None  # Return None if "Home >" is not found

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
        for i , page in enumerate(pdf.pages, start=1):
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
                if 'scmill' in pdf_path:
                    header_extracted = extract_header(text)
                    last_header = clean_text(header_extracted)
                    chars = page.chars
                    wrapped_text = wrap_bold_text(text, chars)
                    wrapped_text = wrap_large_bold_sentences(wrapped_text, chars)
                    wrapped_text = remove_home_header(wrapped_text)
                    PageContent_accumulator.append((i, wrapped_text))
                else:
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

def process_webinar_text(text_file_path):
    results = []
    try:
        with open(text_file_path, 'r', encoding='utf-8') as text_file:
            main_header = None  # Initialize main_header as None
            for line in text_file:
                line = line.strip()
                if line:  # Check if the line contains text
                    main_header = line  # Set main_header
                    break  # Exit the loop
            remaining_lines = text_file.readlines()
            
            paragraphs = []
            current_paragraph = []
            for line in remaining_lines:
                line = line.strip()
                if line:
                    current_paragraph.append(line)
                else:
                    if current_paragraph:
                        paragraphs.append(" ".join(current_paragraph))
                        current_paragraph = []
            
            if current_paragraph:
                paragraphs.append(" ".join(current_paragraph))
            
            for paragraph in paragraphs:
                first_paren_index = paragraph.find('(')
                if first_paren_index != -1:
                    first_line = paragraph[:first_paren_index].strip()
                    rest_of_paragraph = paragraph[first_paren_index:]
                else:
                    first_line = paragraph
                    rest_of_paragraph = ''
                
                header_and_first_line = f"{main_header} | {first_line}"
                
                paragraph_data = {
                    "header": header_and_first_line,
                    "contents": [
                        {
                            "page_number": 0,
                            "PageContent": rest_of_paragraph
                        }
                    ]
                }
                results.append(paragraph_data)
            
    except FileNotFoundError:
        print(f"Text file {text_file_path} not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

    return results


if __name__ == "__main__":
    pdf_path = sys.argv[1]  # Get the PDF path from the command line argument
    # Check if 'webinar' is in the file name
    if pdf_path.endswith('.txt'):
        # Call the functions specific to webinar PDFs
        results = process_webinar_text(pdf_path)
        sys.stdout.write(json.dumps(results))
    else:
        pages_with_home = find_pages_starting_with(pdf_path, "Home >")
        print("pages_with_home", pages_with_home)
        input()

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
        if results:
            results.pop()
        sys.stdout.write(json.dumps(results))





